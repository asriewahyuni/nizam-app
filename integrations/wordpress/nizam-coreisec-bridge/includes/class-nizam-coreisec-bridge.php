<?php

defined('ABSPATH') || exit;

final class Nizam_Coreisec_Bridge {
    const VERSION = '1.0.0';
    const CRON_HOOK = 'nizam_coreisec_bridge_poll';
    const OPTION_STATE = 'nizam_coreisec_bridge_poll_state';
    const NONCE_PREFIX = 'nizam_bridge_nonce_';

    public static function boot() {
        add_filter('cron_schedules', array(__CLASS__, 'cron_schedules'));
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
        add_action(self::CRON_HOOK, array(__CLASS__, 'poll_source_tables'));
        add_action('user_register', array(__CLASS__, 'capture_user'), 10, 1);
        add_action('profile_update', array(__CLASS__, 'capture_user'), 10, 1);
        add_action('deleted_user', array(__CLASS__, 'capture_deleted_user'), 10, 1);
        add_action('save_post', array(__CLASS__, 'capture_post'), 20, 3);
        add_action('before_delete_post', array(__CLASS__, 'capture_deleted_post'), 10, 1);
    }

    public static function cron_schedules($schedules) {
        $schedules['minute'] = array(
            'interval' => 60,
            'display' => 'Setiap menit',
        );
        return $schedules;
    }

    public static function activate() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::outbox_table();
        $charset = $wpdb->get_charset_collate();
        dbDelta(
            "CREATE TABLE {$table} (
                id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
                entity_type varchar(64) NOT NULL,
                external_id varchar(191) NOT NULL,
                operation varchar(16) NOT NULL DEFAULT 'UPSERT',
                payload longtext NOT NULL,
                payload_sha256 char(64) NOT NULL,
                event_signature char(64) NOT NULL,
                source_updated_at datetime NULL,
                occurred_at datetime NOT NULL,
                available_at datetime NOT NULL,
                attempts int(11) unsigned NOT NULL DEFAULT 0,
                delivered_at datetime NULL,
                last_error text NULL,
                PRIMARY KEY  (id),
                UNIQUE KEY entity_fingerprint (entity_type, external_id, payload_sha256),
                KEY delivery_queue (delivered_at, available_at, id)
            ) {$charset};"
        );
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time() + 60, 'minute', self::CRON_HOOK);
        }
        self::poll_source_tables();
    }

    public static function deactivate() {
        $timestamp = wp_next_scheduled(self::CRON_HOOK);
        if ($timestamp) {
            wp_unschedule_event($timestamp, self::CRON_HOOK);
        }
    }

    private static function outbox_table() {
        global $wpdb;
        return $wpdb->prefix . 'nizam_bridge_outbox';
    }

    private static function secret() {
        if (!defined('NIZAM_BRIDGE_SECRET')) {
            return '';
        }
        return trim((string) NIZAM_BRIDGE_SECRET);
    }

    private static function canonical_json($value) {
        if (is_array($value)) {
            $is_list = array_keys($value) === range(0, count($value) - 1);
            if (!$is_list) {
                ksort($value, SORT_STRING);
            }
            foreach ($value as $key => $item) {
                $value[$key] = json_decode(self::canonical_json($item), true);
            }
        } elseif (is_object($value)) {
            return self::canonical_json((array) $value);
        }
        return wp_json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private static function event_signature($entity_type, $external_id, $operation, $checksum, $occurred_at) {
        $secret = self::secret();
        if ($secret === '') {
            return str_repeat('0', 64);
        }
        return hash_hmac(
            'sha256',
            implode("\n", array($entity_type, $external_id, $operation, $checksum, $occurred_at)),
            $secret
        );
    }

    public static function enqueue($entity_type, $external_id, $operation, $payload, $source_updated_at = null) {
        global $wpdb;
        $entity_type = sanitize_key($entity_type);
        $external_id = sanitize_text_field((string) $external_id);
        $operation = strtoupper((string) $operation) === 'DELETE' ? 'DELETE' : 'UPSERT';
        if ($entity_type === '' || $external_id === '') {
            return false;
        }
        $payload_json = self::canonical_json($payload);
        $checksum = hash('sha256', $payload_json);
        $occurred_at = gmdate('Y-m-d H:i:s');
        $signature = self::event_signature(
            $entity_type,
            $external_id,
            $operation,
            $checksum,
            $occurred_at
        );
        $inserted = $wpdb->query(
            $wpdb->prepare(
                "INSERT IGNORE INTO " . self::outbox_table() . "
                    (entity_type, external_id, operation, payload, payload_sha256,
                     event_signature, source_updated_at, occurred_at, available_at)
                 VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                $entity_type,
                $external_id,
                $operation,
                $payload_json,
                $checksum,
                $signature,
                $source_updated_at,
                $occurred_at,
                $occurred_at
            )
        );
        return $inserted !== false;
    }

    public static function capture_user($user_id) {
        $user = get_userdata((int) $user_id);
        if (!$user) {
            return;
        }
        self::enqueue(
            'user',
            (string) $user->ID,
            'UPSERT',
            array(
                'id' => (string) $user->ID,
                'email' => strtolower((string) $user->user_email),
                'username' => (string) $user->user_login,
                'displayName' => (string) $user->display_name,
                'passwordHash' => (string) $user->user_pass,
                'roles' => array_values((array) $user->roles),
                'registeredAt' => mysql_to_rfc3339($user->user_registered),
                'profile' => array(
                    'firstName' => get_user_meta($user->ID, 'first_name', true),
                    'lastName' => get_user_meta($user->ID, 'last_name', true),
                    'phone' => get_user_meta($user->ID, 'phone', true),
                ),
            ),
            $user->user_registered
        );
    }

    public static function capture_deleted_user($user_id) {
        self::enqueue('user', (string) $user_id, 'DELETE', array('id' => (string) $user_id));
    }

    private static function post_entity_type($post_type) {
        $mapping = array(
            'sejoli-access' => 'course',
            'lp_course' => 'course',
            'lp_lesson' => 'lesson',
            'lp_quiz' => 'quiz',
            'lp_question' => 'question',
            'sejoli-product' => 'product',
            'sejoli-lms-cert' => 'certificate',
            'page' => 'cms_content',
            'post' => 'cms_content',
            'attachment' => 'media',
        );
        return isset($mapping[$post_type]) ? $mapping[$post_type] : null;
    }

    public static function capture_post($post_id, $post, $update) {
        if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
            return;
        }
        $entity_type = self::post_entity_type($post->post_type);
        if (!$entity_type) {
            return;
        }
        $meta = get_post_meta($post_id);
        self::enqueue(
            $entity_type,
            (string) $post_id,
            'UPSERT',
            array(
                'id' => (string) $post_id,
                'postType' => $post->post_type,
                'slug' => $post->post_name,
                'title' => $post->post_title,
                'contentHtml' => $post->post_content,
                'excerpt' => $post->post_excerpt,
                'status' => $post->post_status,
                'parentId' => (string) $post->post_parent,
                'mimeType' => $post->post_mime_type,
                'url' => $post->post_type === 'attachment' ? wp_get_attachment_url($post_id) : get_permalink($post_id),
                'metadata' => $meta,
                'updatedAt' => mysql_to_rfc3339($post->post_modified_gmt . ' GMT'),
                'isUpdate' => (bool) $update,
            ),
            $post->post_modified_gmt
        );
    }

    public static function capture_deleted_post($post_id) {
        $post = get_post($post_id);
        if (!$post) {
            return;
        }
        $entity_type = self::post_entity_type($post->post_type);
        if ($entity_type) {
            self::enqueue($entity_type, (string) $post_id, 'DELETE', array('id' => (string) $post_id));
        }
    }

    private static function poll_definitions() {
        global $wpdb;
        return array(
            array('table' => $wpdb->prefix . 'sejolisa_orders', 'entity' => 'order_archive', 'id' => 'ID', 'updated' => 'updated_at'),
            array('table' => $wpdb->prefix . 'sejolisa_subscriptions', 'entity' => 'subscription', 'id' => 'ID', 'updated' => 'updated_at'),
            array('table' => $wpdb->prefix . 'sejolisa_coupons', 'entity' => 'coupon', 'id' => 'ID', 'updated' => 'updated_at'),
            array('table' => $wpdb->prefix . 'sejolisa_affiliates', 'entity' => 'commission', 'id' => 'ID', 'updated' => 'updated_at'),
            array('table' => $wpdb->prefix . 'sejolisa_lms_complete_course', 'entity' => 'progress', 'id' => 'id', 'updated' => 'completed_date'),
            array('table' => $wpdb->prefix . 'learnpress_user_items', 'entity' => 'learnpress_user_item', 'id' => 'user_item_id', 'updated' => 'end_time'),
        );
    }

    private static function row_is_deleted($row) {
        if (!isset($row['deleted_at'])) {
            return false;
        }
        $value = trim((string) $row['deleted_at']);
        return $value !== ''
            && $value !== '0000-00-00 00:00:00'
            && $value !== '1970-01-01 00:00:00';
    }

    public static function poll_source_tables() {
        global $wpdb;
        $state = get_option(self::OPTION_STATE, array());
        foreach (self::poll_definitions() as $definition) {
            $table = $definition['table'];
            $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
            if ($exists !== $table) {
                continue;
            }
            $cursor = isset($state[$table]) && is_array($state[$table])
                ? $state[$table]
                : array('updated' => '1970-01-01 00:00:00', 'id' => 0);
            $id_column = esc_sql($definition['id']);
            $updated_column = esc_sql($definition['updated']);
            $rows = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT * FROM {$table}
                     WHERE COALESCE({$updated_column}, '1970-01-01 00:00:00') > %s
                        OR (
                          COALESCE({$updated_column}, '1970-01-01 00:00:00') = %s
                          AND {$id_column} > %d
                        )
                     ORDER BY COALESCE({$updated_column}, '1970-01-01 00:00:00'), {$id_column}
                     LIMIT 500",
                    $cursor['updated'],
                    $cursor['updated'],
                    (int) $cursor['id']
                ),
                ARRAY_A
            );
            foreach ($rows as $row) {
                $external_id = (string) $row[$definition['id']];
                $updated_at = !empty($row[$definition['updated']])
                    ? (string) $row[$definition['updated']]
                    : '1970-01-01 00:00:00';
                self::enqueue(
                    $definition['entity'],
                    $external_id,
                    self::row_is_deleted($row) ? 'DELETE' : 'UPSERT',
                    array('sourceTable' => $table, 'row' => $row),
                    $updated_at
                );
                $state[$table] = array('updated' => $updated_at, 'id' => (int) $external_id);
            }
        }
        update_option(self::OPTION_STATE, $state, false);
    }

    public static function register_routes() {
        register_rest_route(
            'nizam-bridge/v1',
            '/outbox',
            array(
                'methods' => WP_REST_Server::READABLE,
                'permission_callback' => array(__CLASS__, 'authorize_request'),
                'callback' => array(__CLASS__, 'read_outbox'),
            )
        );
        register_rest_route(
            'nizam-bridge/v1',
            '/ack',
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'permission_callback' => array(__CLASS__, 'authorize_request'),
                'callback' => array(__CLASS__, 'ack_outbox'),
            )
        );
        register_rest_route(
            'nizam-bridge/v1',
            '/health',
            array(
                'methods' => WP_REST_Server::READABLE,
                'permission_callback' => array(__CLASS__, 'authorize_request'),
                'callback' => array(__CLASS__, 'health'),
            )
        );
    }

    public static function authorize_request($request) {
        $secret = self::secret();
        if (strlen($secret) < 32) {
            return new WP_Error('bridge_not_configured', 'NIZAM_BRIDGE_SECRET belum dikonfigurasi.', array('status' => 503));
        }
        $timestamp = trim((string) $request->get_header('x-nizam-timestamp'));
        $nonce = trim((string) $request->get_header('x-nizam-nonce'));
        $signature = strtolower(trim((string) $request->get_header('x-nizam-signature')));
        if (!ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300) {
            return new WP_Error('expired_signature', 'Timestamp tanda tangan kedaluwarsa.', array('status' => 401));
        }
        if (!preg_match('/^[a-zA-Z0-9_-]{16,128}$/', $nonce)) {
            return new WP_Error('invalid_nonce', 'Nonce tidak valid.', array('status' => 401));
        }
        $nonce_key = self::NONCE_PREFIX . hash('sha256', $nonce);
        if (get_transient($nonce_key)) {
            return new WP_Error('replayed_request', 'Permintaan berulang ditolak.', array('status' => 409));
        }
        $body_hash = hash('sha256', (string) $request->get_body());
        $signed = implode(
            "\n",
            array($request->get_method(), $request->get_route(), $timestamp, $nonce, $body_hash)
        );
        $expected = hash_hmac('sha256', $signed, $secret);
        if (!preg_match('/^[a-f0-9]{64}$/', $signature) || !hash_equals($expected, $signature)) {
            return new WP_Error('invalid_signature', 'Tanda tangan tidak valid.', array('status' => 401));
        }
        set_transient($nonce_key, '1', 600);
        return true;
    }

    public static function read_outbox($request) {
        global $wpdb;
        $after = max(0, (int) $request->get_param('after'));
        $limit = min(500, max(1, (int) $request->get_param('limit')));
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, entity_type, external_id, operation, payload,
                        payload_sha256, event_signature, source_updated_at, occurred_at
                 FROM " . self::outbox_table() . "
                 WHERE id > %d AND delivered_at IS NULL AND available_at <= UTC_TIMESTAMP()
                 ORDER BY id ASC LIMIT %d",
                $after,
                $limit
            ),
            ARRAY_A
        );
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['payload'] = json_decode($row['payload'], true);
        }
        return rest_ensure_response(
            array(
                'bridgeVersion' => self::VERSION,
                'events' => $rows,
                'nextCursor' => empty($rows) ? $after : end($rows)['id'],
                'hasMore' => count($rows) === $limit,
            )
        );
    }

    public static function ack_outbox($request) {
        global $wpdb;
        $ids = array_values(array_filter(array_map('intval', (array) $request->get_param('ids'))));
        if (empty($ids)) {
            return new WP_Error('empty_ack', 'Daftar event kosong.', array('status' => 400));
        }
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));
        $query = $wpdb->prepare(
            "UPDATE " . self::outbox_table() . "
             SET delivered_at = UTC_TIMESTAMP(), attempts = attempts + 1
             WHERE id IN ({$placeholders}) AND delivered_at IS NULL",
            $ids
        );
        $updated = $wpdb->query($query);
        return rest_ensure_response(array('acknowledged' => (int) $updated));
    }

    public static function health() {
        global $wpdb;
        $pending = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM " . self::outbox_table() . " WHERE delivered_at IS NULL"
        );
        return rest_ensure_response(
            array(
                'status' => 'ok',
                'version' => self::VERSION,
                'pendingEvents' => $pending,
                'serverTime' => time(),
            )
        );
    }
}
