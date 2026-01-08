<?php
/**
 * Centrální API autentizační systém pro Webfusion Connector
 * Verifikuje API klíče z Task Manager aplikace
 *
 * Autor: Milan Vodák | Webfusion s.r.o.
 */

defined('ABSPATH') or die('Access denied');

/**
 * Ověří API klíč z WP REST API requestu
 *
 * @param WP_REST_Request $request REST API request objekt
 * @return WP_Error|true Vrací true pokud je autorizace OK, jinak WP_Error
 */
function wbf_connector_verify_api_key($request) {
    $api_key = $request->get_header('X-WBF-API-Key');

    if (empty($api_key)) {
        return new WP_Error(
            'missing_api_key',
            'API key is required. Please provide X-WBF-API-Key header.',
            array('status' => 401)
        );
    }

    $stored_key = get_option('wbf_connector_api_key', '');

    if (empty($stored_key)) {
        return new WP_Error(
            'api_not_configured',
            'API key not configured on this website. Please configure it in WBF Connector settings.',
            array('status' => 503)
        );
    }

    if (!hash_equals($stored_key, $api_key)) {
        return new WP_Error(
            'invalid_api_key',
            'Invalid API key provided.',
            array('status' => 403)
        );
    }

    return true;
}

/**
 * Generuje nový API klíč pro tento web
 *
 * @return string Nový 64-znakový API klíč
 */
function wbf_connector_generate_api_key() {
    return bin2hex(random_bytes(32));
}

/**
 * Rotuje (regeneruje) API klíč
 * Pouze admin může rotovat klíč
 *
 * @return string|WP_Error Nový API klíč nebo WP_Error
 */
function wbf_connector_rotate_api_key() {
    if (!current_user_can('manage_options')) {
        return new WP_Error(
            'unauthorized',
            'Only administrators can rotate API key.',
            array('status' => 403)
        );
    }

    $new_key = wbf_connector_generate_api_key();
    update_option('wbf_connector_api_key', $new_key);
    update_option('wbf_connector_api_key_created_at', current_time('mysql'));

    return $new_key;
}

/**
 * Získá současný API klíč (pouze pro admin)
 *
 * @return string|null API klíč nebo null pokud neexistuje
 */
function wbf_connector_get_api_key() {
    if (!current_user_can('manage_options')) {
        return null;
    }

    return get_option('wbf_connector_api_key', '');
}

/**
 * Inicializuje API klíč pokud ještě neexistuje
 * Volá se při aktivaci pluginu
 */
function wbf_connector_init_api_key() {
    $existing_key = get_option('wbf_connector_api_key', '');

    if (empty($existing_key)) {
        $new_key = wbf_connector_generate_api_key();
        update_option('wbf_connector_api_key', $new_key);
        update_option('wbf_connector_api_key_created_at', current_time('mysql'));
    }
}

// Hook pro inicializaci API klíče při aktivaci pluginu
register_activation_hook(dirname(__FILE__, 2) . '/web-status-feed.php', 'wbf_connector_init_api_key');
