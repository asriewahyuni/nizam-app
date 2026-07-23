<?php
/**
 * Exporter read-only WordPress Coreisec. File ini dikirim melalui STDIN SSH dan
 * tidak perlu disalin ke server. Output hanya NDJSON kontrak migrasi.
 */

ini_set('display_errors', '0');
error_reporting(E_ERROR | E_PARSE);
require getcwd() . '/wp-load.php';

global $wpdb;

function nizam_emit($entity_type, $external_id, $updated_at, $payload) {
    echo wp_json_encode(array(
        'entityType' => (string) $entity_type,
        'externalId' => (string) $external_id,
        'updatedAt' => nizam_rfc3339($updated_at),
        'payload' => $payload,
    ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
}

function nizam_rfc3339($value) {
    $raw = trim((string) $value);
    if ($raw === '' || preg_match('/^0{4}-0{2}-0{2}/', $raw)) return null;
    $timestamp = strtotime($raw . (preg_match('/(?:Z|[+-]\\d\\d:?\\d\\d|\\bGMT)$/i', $raw) ? '' : ' GMT'));
    return $timestamp === false ? null : gmdate('Y-m-d\\TH:i:s\\Z', $timestamp);
}

function nizam_meta($post_id, $key, $default = null) {
    $value = get_post_meta((int) $post_id, $key, true);
    return ($value === '' || $value === null) ? $default : maybe_unserialize($value);
}

function nizam_status($post_status) {
    if ($post_status === 'publish') return 'PUBLISHED';
    if ($post_status === 'trash') return 'ARCHIVED';
    return 'DRAFT';
}

function nizam_bool($value, $default = false) {
    if ($value === null || $value === '') return $default;
    return in_array(strtolower((string) $value), array('1', 'true', 'yes', 'on', 'active'), true);
}

function nizam_number($value, $default = 0) {
    if (is_numeric($value)) return (float) $value;
    $clean = preg_replace('/[^0-9,.-]/', '', (string) $value);
    $clean = str_replace(',', '.', $clean);
    return is_numeric($clean) ? (float) $clean : $default;
}

function nizam_quiz_option_title($value) {
    return preg_replace(
        '/^\\s*\\[\\s*(?:true|correct|benar)\\s*\\]\\s*(?:[-:–—]\\s*)?/iu',
        '',
        (string) $value
    );
}

function nizam_duration_seconds($value) {
    $raw = trim((string) $value);
    if ($raw === '') return null;
    if (preg_match('/^(\d+):(\d+):(\d+)$/', $raw, $m)) {
        return ((int) $m[1] * 3600) + ((int) $m[2] * 60) + (int) $m[3];
    }
    if (preg_match('/^(\d+)\s*(second|minute|hour|day|week)/i', $raw, $m)) {
        $factor = array(
            'second' => 1, 'minute' => 60, 'hour' => 3600,
            'day' => 86400, 'week' => 604800,
        );
        return (int) $m[1] * $factor[strtolower($m[2])];
    }
    return null;
}

function nizam_source_url($value) {
    $raw = trim((string) $value);
    if ($raw === '') return null;
    if (ctype_digit($raw)) {
        $attachment = wp_get_attachment_url((int) $raw);
        return $attachment ?: null;
    }
    return preg_match('#^https?://#i', $raw) ? $raw : null;
}

function nizam_native_syllabus($post_id) {
    $sections = array();
    foreach (get_post_meta((int) $post_id) as $key => $values) {
        if (strpos($key, '_sac_silabus|') !== 0) continue;
        if (!preg_match('/^_sac_silabus\|([^|]+)\|([0-9:]+)\|0\|value$/', $key, $match)) {
            continue;
        }
        $field_path = explode(':', $match[1]);
        $field = end($field_path);
        $indexes = array_map('intval', explode(':', $match[2]));
        $value = isset($values[0]) ? maybe_unserialize($values[0]) : '';
        $section_index = $indexes[0];
        if (!isset($sections[$section_index])) {
            $sections[$section_index] = array('fields' => array(), 'lessons' => array());
        }
        if (count($indexes) === 1) {
            $sections[$section_index]['fields'][$field] = $value;
            continue;
        }
        $lesson_index = $indexes[1];
        if (!isset($sections[$section_index]['lessons'][$lesson_index])) {
            $sections[$section_index]['lessons'][$lesson_index] = array(
                'fields' => array(),
                'attachments' => array(),
            );
        }
        if (count($indexes) === 2) {
            $sections[$section_index]['lessons'][$lesson_index]['fields'][$field] = $value;
            continue;
        }
        $attachment_index = $indexes[2];
        if (!isset($sections[$section_index]['lessons'][$lesson_index]['attachments'][$attachment_index])) {
            $sections[$section_index]['lessons'][$lesson_index]['attachments'][$attachment_index] = array();
        }
        $sections[$section_index]['lessons'][$lesson_index]['attachments'][$attachment_index][$field] = $value;
    }
    ksort($sections);
    foreach ($sections as &$section) {
        ksort($section['lessons']);
        foreach ($section['lessons'] as &$lesson) ksort($lesson['attachments']);
    }
    return $sections;
}

function nizam_product_associations($post_id) {
    $ids = array();
    foreach (get_post_meta((int) $post_id) as $key => $values) {
        if (preg_match('/^_product_association\|\|\|(\d+)\|id$/', $key)) {
            foreach ($values as $value) {
                $id = (int) maybe_unserialize($value);
                if ($id > 0) $ids[] = (string) $id;
            }
        }
    }
    return array_values(array_unique($ids));
}

$entities = array(
    'users' => array(), 'courses' => array(), 'sections' => array(),
    'lessons' => array(), 'assets' => array(), 'quizzes' => array(),
    'questions' => array(), 'products' => array(), 'product_courses' => array(),
    'enrollments' => array(), 'progress' => array(), 'orders' => array(),
    'subscriptions' => array(), 'coupons' => array(), 'affiliates' => array(),
    'commissions' => array(), 'cms' => array(), 'redirects' => array(),
    'media' => array(),
);

// Pengguna dan hash WordPress.
$known_user_ids = array();
foreach (get_users(array('fields' => 'all')) as $user) {
    $known_user_ids[(string) $user->ID] = true;
    $source_email = strtolower(trim((string) $user->user_email));
    $login_disabled = !is_email($source_email);
    $migration_email = $login_disabled
        ? 'legacy-user+' . $user->ID . '@invalid.coreisec.id'
        : $source_email;
    $entities['users'][] = array('user', (string) $user->ID, $user->user_registered, array(
        'email' => $migration_email,
        'username' => (string) $user->user_login,
        'displayName' => (string) $user->display_name,
        'passwordHash' => (string) $user->user_pass,
        'roles' => array_values((array) $user->roles),
        'registeredAt' => nizam_rfc3339($user->user_registered),
        'profile' => array(
            'firstName' => (string) get_user_meta($user->ID, 'first_name', true),
            'lastName' => (string) get_user_meta($user->ID, 'last_name', true),
            'phone' => (string) get_user_meta($user->ID, 'phone', true),
            'sourceEmail' => $source_email,
        ),
        'loginDisabled' => $login_disabled,
    ));
}

// Course native Sejoli, bab, lesson, video, lampiran, dan produk terkait.
$native_courses = get_posts(array(
    'post_type' => 'sejoli-access',
    'post_status' => array('publish', 'draft', 'private', 'trash'),
    'posts_per_page' => -1,
    'orderby' => 'ID',
    'order' => 'ASC',
));
$native_lesson_lookup = array();
foreach ($native_courses as $course) {
    $course_id = (string) $course->ID;
    $duration_seconds = nizam_duration_seconds(nizam_meta($course->ID, '_sac_total_duration'));
    $entities['courses'][] = array('course', $course_id, $course->post_modified_gmt, array(
        'slug' => $course->post_name ?: 'course-' . $course_id,
        'title' => $course->post_title,
        'descriptionHtml' => $course->post_content,
        'status' => nizam_status($course->post_status),
        'level' => null,
        'featured' => false,
        'listed' => nizam_meta($course->ID, '_listing_active', 'yes') !== 'no',
        'previewVideoUrl' => nizam_source_url(nizam_meta($course->ID, '_sac_video_preview')),
        'durationMinutes' => $duration_seconds ? (int) ceil($duration_seconds / 60) : null,
        'outcomes' => array(),
        'accessDurationValue' => null,
        'accessDurationUnit' => null,
        'closedAccessMessage' => (string) nizam_meta($course->ID, '_access_block_message', ''),
        'seoTitle' => (string) nizam_meta($course->ID, '_yoast_wpseo_title', ''),
        'seoDescription' => (string) nizam_meta($course->ID, '_yoast_wpseo_metadesc', ''),
        'sourceSnapshot' => array('postType' => 'sejoli-access'),
    ));
    foreach (nizam_native_syllabus($course->ID) as $section_index => $section) {
        $section_external = 'native-section:' . $course_id . ':' . $section_index;
        $section_title = trim((string) ($section['fields']['title'] ?? ''));
        if ($section_title === '') $section_title = 'Bab ' . ($section_index + 1);
        $entities['sections'][] = array('section', $section_external, $course->post_modified_gmt, array(
            'courseExternalId' => $course_id,
            'title' => $section_title,
            'description' => null,
            'sortOrder' => (int) $section_index,
        ));
        foreach ($section['lessons'] as $lesson_index => $lesson) {
            $field = $lesson['fields'];
            $lesson_external = 'native-lesson:' . $course_id . ':' . $section_index . ':' . $lesson_index;
            $native_lesson_lookup[$course_id . ':' . $section_index . ':' . $lesson_index] = $lesson_external;
            $lesson_title = trim((string) ($field['sac_lesson_title'] ?? ''));
            if ($lesson_title === '') $lesson_title = 'Lesson ' . ($lesson_index + 1);
            $lesson_slug = sanitize_title($lesson_title);
            if ($lesson_slug === '') {
                $lesson_slug = 'lesson-' . $course_id . '-' . $section_index . '-' . $lesson_index;
            }
            $source = strtolower((string) ($field['sac_lesson_source'] ?? 'text'));
            $url = nizam_source_url($field['sac_lesson_url'] ?? null);
            $embed = nizam_source_url($field['sac_lesson_embed'] ?? null);
            $lesson_type = in_array($source, array('youtube', 'video', 'vimeo'), true)
                ? 'VIDEO'
                : ($source === 'audio' ? 'AUDIO' : 'TEXT');
            $entities['lessons'][] = array('lesson', $lesson_external, $course->post_modified_gmt, array(
                'courseExternalId' => $course_id,
                'sectionExternalId' => $section_external,
                'slug' => $lesson_slug,
                'title' => $lesson_title,
                'lessonType' => $lesson_type,
                'contentHtml' => (string) ($field['sac_lesson_content'] ?? ''),
                'sortOrder' => (int) $lesson_index,
                'required' => true,
                'preview' => nizam_bool($field['sac_preview_content'] ?? false),
                'durationSeconds' => nizam_duration_seconds($field['sac_lesson_duration'] ?? null),
                'dripValue' => isset($section['fields']['sac_drip_interval_number'])
                    ? (int) $section['fields']['sac_drip_interval_number'] : null,
                'dripUnit' => strtoupper((string) ($section['fields']['sac_drip_interval_duration'] ?? 'HOUR')),
                'embedProvider' => $source ?: null,
                'embedUrl' => $embed ?: $url,
                'mediaItems' => array(),
                'sourceSnapshot' => array('nativeIndexes' => array($section_index, $lesson_index)),
            ));
            if ($lesson_type === 'VIDEO' || $lesson_type === 'AUDIO' || $url || $embed) {
                $entities['assets'][] = array(
                    'lesson_asset',
                    'native-asset:' . $course_id . ':' . $section_index . ':' . $lesson_index . ':video',
                    $course->post_modified_gmt,
                    array(
                        'lessonExternalId' => $lesson_external,
                        'assetType' => $lesson_type === 'AUDIO' ? 'AUDIO' : 'VIDEO',
                        'title' => $lesson_title ?: 'Video',
                        'sourceUrl' => $embed ?: $url,
                        'storageKey' => null,
                        'mimeType' => null,
                        'fileSizeBytes' => null,
                        'checksumSha256' => null,
                        'downloadable' => false,
                        'sortOrder' => 0,
                    ),
                );
            }
            foreach ($lesson['attachments'] as $attachment_index => $attachment) {
                $attachment_url = nizam_source_url($attachment['sac_lesson_attach_file'] ?? null)
                    ?: nizam_source_url($attachment['sac_lesson_attach_link'] ?? null);
                if (!$attachment_url && empty(array_filter($attachment, function ($value) {
                    return trim((string) $value) !== '' && trim((string) $value) !== '_';
                }))) continue;
                $entities['assets'][] = array(
                    'lesson_asset',
                    'native-asset:' . $course_id . ':' . $section_index . ':' . $lesson_index . ':attach:' . $attachment_index,
                    $course->post_modified_gmt,
                    array(
                        'lessonExternalId' => $lesson_external,
                        'assetType' => 'DOCUMENT',
                        'title' => trim((string) ($attachment['sac_lesson_attach_title'] ?? ''))
                            ?: ('Lampiran ' . ($attachment_index + 1)),
                        'sourceUrl' => $attachment_url,
                        'storageKey' => null,
                        'mimeType' => null,
                        'fileSizeBytes' => null,
                        'checksumSha256' => null,
                        'downloadable' => true,
                        'sortOrder' => (int) $attachment_index,
                    ),
                );
            }
        }
    }
    foreach (nizam_product_associations($course->ID) as $product_id) {
        $entities['product_courses'][] = array(
            'product_course',
            'product-course:' . $product_id . ':' . $course_id,
            $course->post_modified_gmt,
            array(
                'productExternalId' => $product_id,
                'courseExternalId' => $course_id,
                'accessDurationValue' => null,
                'accessDurationUnit' => null,
            ),
        );
    }
}

// Course LearnPress dan struktur tabel relasinya.
$lp_courses = get_posts(array(
    'post_type' => 'lp_course', 'post_status' => 'any',
    'posts_per_page' => -1, 'orderby' => 'ID', 'order' => 'ASC',
));
foreach ($lp_courses as $course) {
    $duration = nizam_duration_seconds(nizam_meta($course->ID, '_lp_duration'));
    $entities['courses'][] = array('course', (string) $course->ID, $course->post_modified_gmt, array(
        'slug' => $course->post_name ?: 'course-' . $course->ID,
        'title' => $course->post_title,
        'descriptionHtml' => $course->post_content,
        'status' => nizam_status($course->post_status),
        'level' => (string) nizam_meta($course->ID, '_lp_level', ''),
        'featured' => nizam_bool(nizam_meta($course->ID, '_lp_featured')),
        'listed' => true,
        'previewVideoUrl' => null,
        'durationMinutes' => $duration ? (int) ceil($duration / 60) : null,
        'outcomes' => (array) nizam_meta($course->ID, '_lp_key_features', array()),
        'accessDurationValue' => null, 'accessDurationUnit' => null,
        'closedAccessMessage' => null,
        'seoTitle' => (string) nizam_meta($course->ID, '_yoast_wpseo_title', ''),
        'seoDescription' => (string) nizam_meta($course->ID, '_yoast_wpseo_metadesc', ''),
        'sourceSnapshot' => array('postType' => 'lp_course'),
    ));
}

$section_rows = $wpdb->get_results(
    'SELECT * FROM ' . $wpdb->prefix . 'learnpress_sections ORDER BY section_course_id, section_order',
    ARRAY_A
);
$section_course = array();
foreach ($section_rows as $section) {
    $external = 'lp-section:' . $section['section_id'];
    $section_course[(string) $section['section_id']] = (string) $section['section_course_id'];
    $entities['sections'][] = array('section', $external, null, array(
        'courseExternalId' => (string) $section['section_course_id'],
        'title' => trim((string) $section['section_name'])
            ?: ('Bab LearnPress #' . $section['section_id']),
        'description' => (string) $section['section_description'],
        'sortOrder' => (int) $section['section_order'],
    ));
}

$item_rows = $wpdb->get_results(
    'SELECT * FROM ' . $wpdb->prefix . 'learnpress_section_items ORDER BY section_id, item_order',
    ARRAY_A
);
$item_relation = array();
foreach ($item_rows as $item) {
    $item_relation[(string) $item['item_id']] = array(
        'section' => (string) $item['section_id'],
        'course' => $section_course[(string) $item['section_id']] ?? null,
        'order' => (int) $item['item_order'],
    );
}

$lp_lessons = get_posts(array(
    'post_type' => 'lp_lesson', 'post_status' => 'any',
    'posts_per_page' => -1, 'orderby' => 'ID', 'order' => 'ASC',
));
$legacy_lp_course_id = '87';
$legacy_lp_section_id = 'lp-section:legacy:' . $legacy_lp_course_id;
$legacy_lp_section_added = false;
$legacy_lp_order = 0;
foreach ($lp_lessons as $lesson) {
    $relation = $item_relation[(string) $lesson->ID] ?? null;
    if (!$relation || !$relation['course']) {
        if (!$legacy_lp_section_added) {
            $entities['sections'][] = array('section', $legacy_lp_section_id, null, array(
                'courseExternalId' => $legacy_lp_course_id,
                'title' => 'Materi LearnPress Lama',
                'description' => 'Relasi section lama tidak lagi tersedia di tabel LearnPress.',
                'sortOrder' => 999,
            ));
            $legacy_lp_section_added = true;
        }
        $relation = array(
            'course' => $legacy_lp_course_id,
            'section' => null,
            'order' => $legacy_lp_order++,
        );
    }
    $entities['lessons'][] = array('lesson', (string) $lesson->ID, $lesson->post_modified_gmt, array(
        'courseExternalId' => $relation['course'],
        'sectionExternalId' => $relation['section']
            ? 'lp-section:' . $relation['section']
            : $legacy_lp_section_id,
        'slug' => $lesson->post_name ?: 'lesson-' . $lesson->ID,
        'title' => $lesson->post_title,
        'lessonType' => 'TEXT',
        'contentHtml' => $lesson->post_content,
        'sortOrder' => $relation['order'],
        'required' => true,
        'preview' => nizam_bool(nizam_meta($lesson->ID, '_lp_preview')),
        'durationSeconds' => nizam_duration_seconds(nizam_meta($lesson->ID, '_lp_duration')),
        'dripValue' => null, 'dripUnit' => null,
        'embedProvider' => null, 'embedUrl' => null, 'mediaItems' => array(),
        'sourceSnapshot' => array('postType' => 'lp_lesson'),
    ));
}

$quiz_course = array();
foreach ($item_rows as $item) {
    if ($item['item_type'] === 'lp_quiz' && isset($section_course[(string) $item['section_id']])) {
        $quiz_course[(string) $item['item_id']] = $section_course[(string) $item['section_id']];
    }
}
$lp_quiz_ids = $wpdb->get_col(
    "SELECT ID FROM {$wpdb->posts}
     WHERE post_type = 'lp_quiz'
       AND post_status IN ('publish', 'draft', 'pending', 'private', 'future', 'trash')
     ORDER BY ID"
);
$lp_quizzes = array_values(array_filter(array_map('get_post', array_map('intval', $lp_quiz_ids))));
foreach ($lp_quizzes as $quiz) {
    // LearnPress lama sudah kehilangan relasi section untuk sebagian besar kuis,
    // tetapi relasi pertanyaannya masih utuh. Simpan semuanya pada course warisan
    // agar pertanyaan dan histori belajar tidak terbuang.
    $course_id = $quiz_course[(string) $quiz->ID] ?? $legacy_lp_course_id;
    $duration = nizam_duration_seconds(nizam_meta($quiz->ID, '_lp_duration'));
    $entities['quizzes'][] = array('quiz', (string) $quiz->ID, $quiz->post_modified_gmt, array(
        'courseExternalId' => (string) $course_id,
        'lessonExternalId' => null,
        'title' => $quiz->post_title,
        'description' => $quiz->post_content,
        'status' => nizam_status($quiz->post_status),
        'timeLimitMinutes' => $duration ? (int) ceil($duration / 60) : null,
        'maxAttempts' => (int) nizam_meta($quiz->ID, '_lp_retake_count', 0) + 1,
        'passingScore' => nizam_number(nizam_meta($quiz->ID, '_lp_passing_grade', 70), 70),
        'randomizeQuestions' => false, 'randomizeOptions' => false,
        'showExplanations' => nizam_bool(nizam_meta($quiz->ID, '_lp_show_correct_review'), true),
    ));
}

$quiz_question_rows = $wpdb->get_results(
    'SELECT * FROM ' . $wpdb->prefix . 'learnpress_quiz_questions ORDER BY quiz_id, question_order',
    ARRAY_A
);
foreach ($quiz_question_rows as $relation) {
    $question = get_post((int) $relation['question_id']);
    if (!$question) continue;
    $type_map = array(
        'single_choice' => 'SINGLE_CHOICE', 'multi_choice' => 'MULTIPLE_CHOICE',
        'true_or_false' => 'TRUE_FALSE', 'fill_in_blanks' => 'SHORT_TEXT',
        'sorting_choice' => 'ORDERING',
    );
    $source_type = strtolower((string) nizam_meta($question->ID, '_lp_type', 'single_choice'));
    $options = array();
    $answers = $wpdb->get_results(
        $wpdb->prepare(
            'SELECT * FROM ' . $wpdb->prefix . 'learnpress_question_answers WHERE question_id = %d ORDER BY `order`',
            $question->ID
        ),
        ARRAY_A
    );
    foreach ($answers as $answer) {
        $options[] = array(
            'externalId' => (string) $answer['question_answer_id'],
            'html' => nizam_quiz_option_title($answer['title']),
            'correct' => in_array(strtolower((string) $answer['is_true']), array('yes', 'true', '1'), true),
            'sortOrder' => (int) $answer['order'],
            'matchKey' => (string) $answer['value'],
        );
    }
    $entities['questions'][] = array('question', (string) $question->ID, $question->post_modified_gmt, array(
        'quizExternalId' => (string) $relation['quiz_id'],
        'questionBankKey' => null,
        'questionType' => $type_map[$source_type] ?? 'ESSAY',
        'promptHtml' => $question->post_content ?: $question->post_title,
        'explanationHtml' => null,
        'points' => nizam_number(nizam_meta($question->ID, '_lp_mark', 1), 1),
        'sortOrder' => (int) $relation['question_order'],
        'active' => $question->post_status !== 'trash',
        'options' => $options,
    ));
}

// Produk Sejoli.
$products = get_posts(array(
    'post_type' => 'sejoli-product',
    'post_status' => array('publish', 'draft', 'private', 'trash'),
    'posts_per_page' => -1, 'orderby' => 'ID', 'order' => 'ASC',
));
$exported_product_ids = array();
foreach ($products as $product) {
    $exported_product_ids[(string) $product->ID] = true;
    $price = nizam_number(nizam_meta($product->ID, '_price', 0));
    $product_type = strtolower((string) nizam_meta($product->ID, '_product_type', 'digital'));
    $entities['products'][] = array('product', (string) $product->ID, $product->post_modified_gmt, array(
        'slug' => $product->post_name ?: 'product-' . $product->ID,
        'name' => $product->post_title,
        'descriptionHtml' => $product->post_content,
        'sku' => null,
        'physical' => $product_type === 'physical',
        'regularPrice' => $price,
        'salePrice' => null,
        'published' => $product->post_status === 'publish',
        'featured' => false,
        'quantityEnabled' => nizam_bool(nizam_meta($product->ID, '_enable_quantity'), false),
        'purchaseLimitPerUser' => (int) nizam_meta($product->ID, '_limit_buy_time', 0) ?: null,
        'saleStartsAt' => null, 'saleEndsAt' => null,
        'followUpContent' => array(),
        'analyticsConfig' => array(
            'metaPixelEnabled' => nizam_bool(nizam_meta($product->ID, '_fb_pixel_active')),
            'metaPixelId' => (string) nizam_meta($product->ID, '_fb_pixel_id', ''),
            'socialProofEnabled' => nizam_bool(nizam_meta($product->ID, '_social_proof_enable')),
        ),
        'sourceSnapshot' => array(
            'postStatus' => $product->post_status,
            'paymentType' => nizam_meta($product->ID, '_payment_type'),
            'shipmentActive' => nizam_meta($product->ID, '_shipment_active'),
        ),
    ));
}

// Order historis dan enrollment hasil order yang sah.
$orders_table = $wpdb->prefix . 'sejolisa_orders';
$order_rows = $wpdb->get_results('SELECT * FROM ' . $orders_table . ' ORDER BY ID', ARRAY_A);
$product_course_map = array();
foreach ($entities['product_courses'] as $relation) {
    $payload = $relation[3];
    $product_course_map[$payload['productExternalId']][] = $payload['courseExternalId'];
}
$native_enrollment_seen = array();
foreach ($order_rows as $order) {
    $meta = maybe_unserialize($order['meta_data']);
    $completed = in_array($order['status'], array('completed', 'shipping', 'in-progress'), true);
    $entities['orders'][] = array('order_archive', (string) $order['ID'], $order['updated_at'], array(
        'userExternalId' => (int) $order['user_id'] > 0 ? (string) $order['user_id'] : null,
        'orderNumber' => (string) $order['ID'],
        'customerEmail' => is_array($meta) ? (string) ($meta['email'] ?? $meta['billing_email'] ?? '') : null,
        'status' => (string) $order['status'],
        'currency' => 'IDR',
        'totalAmount' => (float) $order['grand_total'],
        'orderedAt' => nizam_rfc3339($order['created_at']),
        'completedAt' => $completed ? nizam_rfc3339($order['updated_at']) : null,
        'grantsAccess' => $completed,
        'needsReview' => !in_array($order['status'], array('completed', 'cancelled'), true),
        'sourceSnapshot' => array_merge($order, array('meta_data' => $meta)),
    ));
    if (!$completed || (int) $order['user_id'] <= 0) continue;
    foreach ($product_course_map[(string) $order['product_id']] ?? array() as $course_id) {
        $external = 'native-enrollment:' . $order['user_id'] . ':' . $course_id;
        if (isset($native_enrollment_seen[$external])) continue;
        $native_enrollment_seen[$external] = true;
        $entities['enrollments'][] = array('enrollment', $external, $order['updated_at'], array(
            'userExternalId' => (string) $order['user_id'],
            'courseExternalId' => (string) $course_id,
            'batchExternalId' => null,
            'status' => 'IN_PROGRESS',
            'startedAt' => nizam_rfc3339($order['created_at']),
            'completedAt' => null, 'finalScore' => null,
        ));
    }
}

// LearnPress enrollment dan progres.
$lp_user_items = $wpdb->get_results(
    'SELECT * FROM ' . $wpdb->prefix . 'learnpress_user_items ORDER BY user_item_id',
    ARRAY_A
);
foreach ($lp_user_items as $item) {
    if ($item['item_type'] === 'lp_course') {
        $entities['enrollments'][] = array('enrollment', (string) $item['user_item_id'], $item['end_time'], array(
            'userExternalId' => (string) $item['user_id'],
            'courseExternalId' => (string) $item['item_id'],
            'batchExternalId' => null,
            'status' => strpos((string) $item['status'], 'finish') !== false ? 'COMPLETED' : 'IN_PROGRESS',
            'startedAt' => nizam_rfc3339($item['start_time']),
            'completedAt' => nizam_rfc3339($item['end_time']),
            'finalScore' => is_numeric($item['graduation']) ? (float) $item['graduation'] : null,
        ));
    } elseif ($item['item_type'] === 'lp_lesson' && (int) $item['parent_id'] > 0) {
        $entities['progress'][] = array('progress', 'lp-progress:' . $item['user_item_id'], $item['end_time'], array(
            'enrollmentExternalId' => (string) $item['parent_id'],
            'lessonExternalId' => (string) $item['item_id'],
            'status' => strpos((string) $item['status'], 'complete') !== false ? 'COMPLETED' : 'VIEWED',
            'viewedAt' => nizam_rfc3339($item['start_time']),
            'completedAt' => nizam_rfc3339($item['end_time']),
            'lastPositionSeconds' => 0,
        ));
    }
}

// Progres native Sejoli.
$native_progress_rows = $wpdb->get_results(
    'SELECT * FROM ' . $wpdb->prefix . 'sejolisa_lms_complete_course ORDER BY id',
    ARRAY_A
);
foreach ($native_progress_rows as $progress) {
    $course_id = (string) $progress['access_id'];
    $section_index = max(0, (int) $progress['chapter']);
    $lesson_index = max(0, (int) $progress['lesson']);
    $lesson_external = $native_lesson_lookup[$course_id . ':' . $section_index . ':' . $lesson_index] ?? null;
    if (!$lesson_external) continue;
    $enrollment_external = 'native-enrollment:' . $progress['user_id'] . ':' . $course_id;
    if (!isset($native_enrollment_seen[$enrollment_external])) {
        $native_enrollment_seen[$enrollment_external] = true;
        $entities['enrollments'][] = array('enrollment', $enrollment_external, $progress['completed_date'], array(
            'userExternalId' => (string) $progress['user_id'],
            'courseExternalId' => $course_id,
            'batchExternalId' => null,
            'status' => 'IN_PROGRESS',
            'startedAt' => nizam_rfc3339($progress['completed_date']),
            'completedAt' => null, 'finalScore' => null,
        ));
    }
    $entities['progress'][] = array('progress', 'native-progress:' . $progress['id'], $progress['completed_date'], array(
        'enrollmentExternalId' => $enrollment_external,
        'lessonExternalId' => $lesson_external,
        'status' => 'COMPLETED',
        'viewedAt' => nizam_rfc3339($progress['completed_date']),
        'completedAt' => nizam_rfc3339($progress['completed_date']),
        'lastPositionSeconds' => 0,
        'sourceSnapshot' => $progress,
    ));
}

// Subscription.
$subscription_rows = $wpdb->get_results(
    'SELECT * FROM ' . $wpdb->prefix . 'sejolisa_subscriptions ORDER BY ID',
    ARRAY_A
);
foreach ($subscription_rows as $subscription) {
    $product_id = (int) $subscription['product_id'];
    $period = strtolower((string) nizam_meta($product_id, '_subscription_period', 'month'));
    $duration = (int) nizam_meta($product_id, '_subscription_duration', 1);
    $entities['subscriptions'][] = array('subscription', (string) $subscription['ID'], $subscription['updated_at'], array(
        'userExternalId' => (string) $subscription['user_id'],
        'productExternalId' => (string) $product_id,
        'planExternalId' => (string) $product_id,
        'planName' => get_the_title($product_id) ?: 'Paket Berlangganan',
        'billingInterval' => strtoupper(in_array($period, array('day','week','month','year'), true) ? $period : 'month'),
        'billingIntervalCount' => max(1, $duration),
        'price' => nizam_number(nizam_meta($product_id, '_price', 0)),
        'trialDays' => nizam_bool(nizam_meta($product_id, '_subscription_has_tryout'))
            ? (int) nizam_meta($product_id, '_subscription_tryout_duration', 0) : 0,
        'signupFee' => nizam_bool(nizam_meta($product_id, '_subscription_has_signup_fee'))
            ? nizam_number(nizam_meta($product_id, '_subscription_signup_fee', 0)) : 0,
        'gracePeriodDays' => (int) nizam_meta($product_id, '_subscription_max_renewal_days', 7),
        'maxCycles' => null,
        'status' => strtoupper($subscription['status']),
        'currentPeriodStart' => nizam_rfc3339($subscription['created_at']),
        'currentPeriodEnd' => nizam_rfc3339($subscription['end_date']),
        'trialEndsAt' => null, 'graceEndsAt' => null,
        'nextRenewalAt' => nizam_rfc3339($subscription['end_date']),
        'cancelledAt' => $subscription['status'] === 'cancelled'
            ? nizam_rfc3339($subscription['updated_at']) : null,
        'providerReference' => (string) $subscription['order_id'],
        'sourceSnapshot' => $subscription,
    ));
}

// Kupon.
$coupon_rows = $wpdb->get_results(
    'SELECT * FROM ' . $wpdb->prefix . 'sejolisa_coupons ORDER BY ID',
    ARRAY_A
);
$coupon_code_seen = array();
foreach ($coupon_rows as $coupon) {
    $discount_raw = (string) $coupon['discount'];
    $original_code = strtoupper(trim((string) $coupon['code']));
    $collision_index = ($coupon_code_seen[$original_code] ?? 0);
    $coupon_code_seen[$original_code] = $collision_index + 1;
    $migration_code = $collision_index === 0
        ? $original_code
        : $original_code . '-LEGACY-' . $coupon['ID'];
    $rule = maybe_unserialize($coupon['rule']);
    $allowed_products = array();
    if (is_array($rule)) {
        foreach ((array) ($rule['apply_only'] ?? array()) as $product_id) {
            $product_external_id = (string) $product_id;
            if (isset($exported_product_ids[$product_external_id])) {
                $allowed_products[] = $product_external_id;
            }
        }
    }
    $entities['coupons'][] = array('coupon', (string) $coupon['ID'], $coupon['updated_at'], array(
        'code' => $migration_code,
        'discountType' => strpos($discount_raw, '%') !== false ? 'PERCENT' : 'FIXED',
        'discountValue' => nizam_number($discount_raw),
        'minimumAmount' => 0, 'startsAt' => null,
        'expiresAt' => nizam_rfc3339($coupon['limit_date']),
        'usageLimit' => (int) $coupon['limit_use'] ?: null,
        'perUserLimit' => 1, 'allowedProductExternalIds' => array_values(array_unique($allowed_products)),
        'active' => $coupon['status'] === 'active' && $collision_index === 0,
        'sourceSnapshot' => array_merge($coupon, array(
            'rule' => $rule,
            'originalCode' => $original_code,
            'duplicateCodeArchived' => $collision_index > 0,
        )),
    ));
}

// Profil afiliasi dari user yang muncul di komisi, lalu komisinya.
$affiliate_rows = $wpdb->get_results(
    'SELECT * FROM ' . $wpdb->prefix . 'sejolisa_affiliates ORDER BY ID',
    ARRAY_A
);
$affiliate_ids = array();
foreach ($affiliate_rows as $commission) {
    if ((int) $commission['affiliate_id'] > 0) $affiliate_ids[(string) $commission['affiliate_id']] = true;
}
foreach (array_keys($affiliate_ids) as $affiliate_id) {
    $user = get_userdata((int) $affiliate_id);
    if (!$user) continue;
    $entities['affiliates'][] = array('affiliate', $affiliate_id, $user->user_registered, array(
        'userExternalId' => $affiliate_id,
        'referralCode' => $user->user_login ?: ('AFF-' . $affiliate_id),
        'status' => 'ACTIVE',
        'payoutDetails' => array(),
        'commissionType' => 'PERCENT',
        'commissionValue' => 0,
        'cookieDays' => 30,
        'sourceSnapshot' => array('roles' => array_values((array) $user->roles)),
    ));
}
foreach ($affiliate_rows as $commission) {
    if (!isset($affiliate_ids[(string) $commission['affiliate_id']])) continue;
    $order_total = 0;
    foreach ($order_rows as $order) {
        if ((string) $order['ID'] === (string) $commission['order_id']) {
            $order_total = (float) $order['grand_total'];
            break;
        }
    }
    $status = $commission['status'] === 'cancelled'
        ? 'CANCELLED'
        : ((int) $commission['paid_status'] === 1 ? 'PAID' : 'PENDING');
    $entities['commissions'][] = array('commission', (string) $commission['ID'], $commission['updated_at'], array(
        'affiliateExternalId' => (string) $commission['affiliate_id'],
        'commissionType' => 'INITIAL',
        'basisAmount' => $order_total,
        'commissionAmount' => (float) $commission['commission'],
        'status' => $status,
        'payableAt' => nizam_rfc3339($commission['created_at']),
        'sourceSnapshot' => $commission,
    ));
}

// CMS bayangan, redirect, dan inventaris media.
$content_posts = get_posts(array(
    'post_type' => array('page', 'post'),
    'post_status' => array('publish', 'draft', 'private', 'trash'),
    'posts_per_page' => -1, 'orderby' => 'ID', 'order' => 'ASC',
));
$redirect_path_seen = array();
foreach ($content_posts as $post) {
    $entities['cms'][] = array('cms_content', (string) $post->ID, $post->post_modified_gmt, array(
        'contentType' => $post->post_type === 'post' ? 'ARTICLE' : 'PAGE',
        'slug' => $post->post_name ?: ('content-' . $post->ID),
        'title' => $post->post_title,
        'excerpt' => $post->post_excerpt ?: null,
        'contentHtml' => $post->post_content,
        'featuredImageStorageKey' => null,
        'seoTitle' => (string) nizam_meta($post->ID, '_yoast_wpseo_title', ''),
        'seoDescription' => (string) nizam_meta($post->ID, '_yoast_wpseo_metadesc', ''),
        'canonicalUrl' => get_permalink($post->ID),
        'status' => nizam_status($post->post_status),
        'publishedAt' => nizam_rfc3339($post->post_date_gmt),
        'analyticsConfig' => array(),
    ));
    $source_path = (string) wp_parse_url(get_permalink($post->ID), PHP_URL_PATH);
    $path_collision = isset($redirect_path_seen[$source_path]);
    $redirect_path_seen[$source_path] = true;
    $entities['redirects'][] = array('cms_redirect', 'content:' . $post->ID, $post->post_modified_gmt, array(
        'sourcePath' => $path_collision
            ? '/__legacy-duplicate/' . $post->ID . $source_path
            : $source_path,
        'destinationUrl' => '/member/core-islamic-economics/content/' . ($post->post_name ?: $post->ID),
        'statusCode' => 301,
        'active' => !$path_collision,
        'sourceSnapshot' => array(
            'originalSourcePath' => $source_path,
            'duplicatePathArchived' => $path_collision,
        ),
    ));
}

$attachments = get_posts(array(
    'post_type' => 'attachment', 'post_status' => 'inherit',
    'posts_per_page' => -1, 'orderby' => 'ID', 'order' => 'ASC',
));
foreach ($attachments as $attachment) {
    $source_url = wp_get_attachment_url($attachment->ID);
    if (!$source_url) continue;
    $file = get_attached_file($attachment->ID);
    $entities['media'][] = array('media', (string) $attachment->ID, $attachment->post_modified_gmt, array(
        'sourceUrl' => $source_url,
        'fileName' => $file ? basename($file) : basename((string) wp_parse_url($source_url, PHP_URL_PATH)),
        'mimeType' => $attachment->post_mime_type ?: null,
        'fileSizeBytes' => ($file && is_file($file)) ? filesize($file) : null,
        'checksumSha256' => null,
        'storageKey' => null,
        'parentExternalId' => $attachment->post_parent ? (string) $attachment->post_parent : null,
        'altText' => (string) get_post_meta($attachment->ID, '_wp_attachment_image_alt', true),
    ));
}

// Beberapa order/progres lama masih menunjuk ID pengguna yang sudah dihapus
// dari wp_users. Buat principal arsip nonaktif agar hak akses historis tetap
// dapat direkonsiliasi tanpa membuka akun login palsu.
$referenced_user_ids = array();
foreach ($entities['enrollments'] as $entity) {
    $user_id = (string) ($entity[3]['userExternalId'] ?? '');
    if ($user_id !== '') $referenced_user_ids[$user_id] = true;
}
foreach ($entities['subscriptions'] as $entity) {
    $user_id = (string) ($entity[3]['userExternalId'] ?? '');
    if ($user_id !== '') $referenced_user_ids[$user_id] = true;
}
foreach ($entities['affiliates'] as $entity) {
    $user_id = (string) ($entity[3]['userExternalId'] ?? '');
    if ($user_id !== '') $referenced_user_ids[$user_id] = true;
}
foreach ($entities['orders'] as $entity) {
    $user_id = (string) ($entity[3]['userExternalId'] ?? '');
    if ($user_id !== '') $referenced_user_ids[$user_id] = true;
}
foreach (array_keys($referenced_user_ids) as $user_id) {
    if (isset($known_user_ids[$user_id])) continue;
    $entities['users'][] = array('user', $user_id, null, array(
        'email' => 'legacy-deleted+' . $user_id . '@invalid.coreisec.id',
        'username' => 'legacy-deleted-' . $user_id,
        'displayName' => 'Pengguna WordPress Terhapus #' . $user_id,
        'passwordHash' => '[WORDPRESS_DELETED]',
        'roles' => array('subscriber'),
        'registeredAt' => null,
        'profile' => array(),
        'sourceDeleted' => true,
    ));
}

$order = array(
    'users', 'courses', 'sections', 'lessons', 'assets', 'quizzes', 'questions',
    'products', 'product_courses', 'affiliates', 'enrollments', 'progress',
    'orders', 'subscriptions', 'coupons', 'commissions',
    'cms', 'redirects', 'media',
);
foreach ($order as $group) {
    foreach ($entities[$group] as $entity) nizam_emit($entity[0], $entity[1], $entity[2], $entity[3]);
}
