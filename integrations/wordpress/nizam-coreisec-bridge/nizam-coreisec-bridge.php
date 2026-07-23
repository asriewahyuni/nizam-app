<?php
/**
 * Plugin Name: Nizam Coreisec Bridge
 * Description: Outbox satu arah bertanda tangan untuk migrasi member, LMS, commerce, dan CMS dari Coreisec ke Nizam.
 * Version: 1.0.0
 * Requires PHP: 7.4
 * Author: Nizam
 */

defined('ABSPATH') || exit;

require_once __DIR__ . '/includes/class-nizam-coreisec-bridge.php';

register_activation_hook(__FILE__, array('Nizam_Coreisec_Bridge', 'activate'));
register_deactivation_hook(__FILE__, array('Nizam_Coreisec_Bridge', 'deactivate'));

Nizam_Coreisec_Bridge::boot();
