<?php
/**
 * REST API endpointy pro Webfusion Connector - Task Manager Integration
 *
 * Poskytuje API rozhraní pro:
 * - Okamžité přihlášení do admin bez expirujícího tokenu
 * - Real-time získání dat o webu
 * - Správu API klíčů
 *
 * Autor: Milan Vodák | Webfusion s.r.o.
 */

defined('ABSPATH') or die('Access denied');

/**
 * ENDPOINT: Okamžité přihlášení do admin
 * POST /wp-json/webfusion-connector/v1/instant-login
 *
 * Generuje jednorázový token s platností 60 sekund pro okamžité přihlášení
 *
 * Headers: X-WBF-API-Key: {api_key}
 * Body: (optional) { "user_id": 1 } - ID uživatele, jinak nejnižší admin
 *
 * Response: {
 *   "success": true,
 *   "login_url": "https://example.com/login-token/abc123...",
 *   "token": "abc123...",
 *   "expires_at": "2024-01-08 10:30:45",
 *   "user_id": 1,
 *   "user_login": "admin"
 * }
 */
function wbf_api_instant_login(WP_REST_Request $request) {
    $auth = wbf_connector_verify_api_key($request);
    if (is_wp_error($auth)) {
        return $auth;
    }

    $user_id = $request->get_param('user_id');

    if (empty($user_id)) {
        global $wpdb;
        $user_id = $wpdb->get_var("
            SELECT ID
            FROM $wpdb->users
            WHERE ID IN (
                SELECT user_id
                FROM $wpdb->usermeta
                WHERE meta_key = '{$wpdb->prefix}capabilities'
                AND meta_value LIKE '%administrator%'
            )
            ORDER BY ID ASC
            LIMIT 1
        ");
    }

    if (empty($user_id)) {
        return new WP_Error(
            'no_admin_user',
            'No administrator user found on this website.',
            array('status' => 500)
        );
    }

    $user = get_userdata($user_id);
    if (!$user) {
        return new WP_Error(
            'user_not_found',
            'User not found.',
            array('status' => 404)
        );
    }

    $token = bin2hex(random_bytes(32));
    $expiration = time() + 60;

    update_user_meta($user_id, 'wbf_instant_login_token', $token);
    update_user_meta($user_id, 'wbf_instant_login_expiration', $expiration);

    $login_url = home_url('/login-token/' . $token);

    return new WP_REST_Response(array(
        'success' => true,
        'login_url' => $login_url,
        'token' => $token,
        'expires_at' => date('Y-m-d H:i:s', $expiration),
        'user_id' => $user_id,
        'user_login' => $user->user_login
    ), 200);
}

/**
 * ENDPOINT: Získání real-time dat o webu
 * GET /wp-json/webfusion-connector/v1/website-data
 *
 * Vrací aktuální kompletní data o webu (stejná jako XML feed, ale live)
 *
 * Headers: X-WBF-API-Key: {api_key}
 *
 * Response: {
 *   "success": true,
 *   "data": {
 *     "wordpress_version": "6.4.2",
 *     "php_version": "8.1.0",
 *     ...
 *   },
 *   "retrieved_at": "2024-01-08 10:30:45"
 * }
 */
function wbf_api_website_data(WP_REST_Request $request) {
    $auth = wbf_connector_verify_api_key($request);
    if (is_wp_error($auth)) {
        return $auth;
    }

    global $wpdb;

    $wordpress_version = get_bloginfo('version');
    $php_version = phpversion();
    $mysql_version = $wpdb->get_var("SELECT VERSION()");
    $memory_limit = ini_get('memory_limit');
    $upload_max_filesize = ini_get('upload_max_filesize');
    $num_pages = wp_count_posts('page')->publish;
    $num_posts = wp_count_posts('post')->publish;
    $num_comments = wp_count_comments();
    $num_users = count_users();
    $https_status = is_ssl() ? 'Aktivní' : 'Neaktivní';
    $indexing_allowed = get_option('blog_public') ? 'Povoleno' : 'Zakázáno';
    $storage_usage = format_size(folder_size(WP_CONTENT_DIR));
    $num_media_files = count(get_posts(array(
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'posts_per_page' => -1
    )));

    $all_plugins = get_plugins();
    $active_plugins = get_option('active_plugins');
    $inactive_plugins = array_diff(array_keys($all_plugins), $active_plugins);

    wp_update_plugins();
    $update_plugins = get_site_transient('update_plugins');
    $update_count = isset($update_plugins->response) ? count($update_plugins->response) : 0;

    $theme = wp_get_theme();
    $theme_name = $theme->get('Name');
    $theme_version = $theme->get('Version');

    $cpu_count = 1;
    $server_load = array(0, 0, 0);
    if (function_exists('shell_exec')) {
        $cpu_count = (int) shell_exec("nproc");
        $server_load = sys_getloadavg();
    }
    $current_load_percentage = ($server_load[0] / $cpu_count) * 100;

    $uptime = 'Neznámo';
    if (function_exists('shell_exec')) {
        $uptime = shell_exec("uptime -p");
        $uptime = format_uptime($uptime);
    }

    $active_plugins_list = array();
    foreach ($active_plugins as $plugin_path) {
        $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_path);
        $active_plugins_list[] = array(
            'name' => $plugin_data['Name'],
            'version' => $plugin_data['Version'],
            'author' => $plugin_data['Author']
        );
    }

    $inactive_plugins_list = array();
    foreach ($inactive_plugins as $plugin_path) {
        $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_path);
        $inactive_plugins_list[] = array(
            'name' => $plugin_data['Name'],
            'version' => $plugin_data['Version'],
            'author' => $plugin_data['Author']
        );
    }

    $update_plugins_list = array();
    if (isset($update_plugins->response)) {
        foreach ($update_plugins->response as $plugin => $update_info) {
            $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin);
            $update_plugins_list[] = array(
                'name' => $plugin_data['Name'],
                'current_version' => $plugin_data['Version'],
                'new_version' => $update_info->new_version
            );
        }
    }

    $users_list = array();
    $users = get_users();
    foreach ($users as $user) {
        $users_list[] = array(
            'id' => $user->ID,
            'login' => $user->user_login,
            'email' => $user->user_email,
            'roles' => $user->roles
        );
    }

    $data = array(
        'site_url' => home_url(),
        'site_name' => get_bloginfo('name'),
        'wordpress_version' => $wordpress_version,
        'php_version' => $php_version,
        'mysql_version' => $mysql_version,
        'memory_limit' => $memory_limit,
        'upload_max_filesize' => $upload_max_filesize,
        'num_pages' => $num_pages,
        'num_posts' => $num_posts,
        'num_comments' => $num_comments->approved,
        'num_users' => $num_users['total_users'],
        'num_media_files' => $num_media_files,
        'https_status' => $https_status,
        'indexing_allowed' => $indexing_allowed,
        'storage_usage' => $storage_usage,
        'active_plugins_count' => count($active_plugins),
        'inactive_plugins_count' => count($inactive_plugins),
        'update_plugins_count' => $update_count,
        'theme_name' => $theme_name,
        'theme_version' => $theme_version,
        'server_load' => number_format($current_load_percentage, 2) . '%',
        'uptime' => $uptime,
        'active_plugins' => $active_plugins_list,
        'inactive_plugins' => $inactive_plugins_list,
        'update_plugins' => $update_plugins_list,
        'users' => $users_list
    );

    return new WP_REST_Response(array(
        'success' => true,
        'data' => $data,
        'retrieved_at' => current_time('mysql')
    ), 200);
}

/**
 * ENDPOINT: Získání aktuálního API klíče
 * GET /wp-json/webfusion-connector/v1/api-key
 *
 * Vrací aktuální API klíč (pouze pokud je požadavek z admin rozhraní)
 *
 * Response: {
 *   "success": true,
 *   "api_key": "abc123...",
 *   "created_at": "2024-01-08 10:30:45"
 * }
 */
function wbf_api_get_api_key(WP_REST_Request $request) {
    if (!current_user_can('manage_options')) {
        return new WP_Error(
            'unauthorized',
            'Only administrators can view API key.',
            array('status' => 403)
        );
    }

    $api_key = get_option('wbf_connector_api_key', '');
    $created_at = get_option('wbf_connector_api_key_created_at', '');

    if (empty($api_key)) {
        wbf_connector_init_api_key();
        $api_key = get_option('wbf_connector_api_key', '');
        $created_at = get_option('wbf_connector_api_key_created_at', '');
    }

    return new WP_REST_Response(array(
        'success' => true,
        'api_key' => $api_key,
        'created_at' => $created_at
    ), 200);
}

/**
 * ENDPOINT: Rotace (regenerace) API klíče
 * POST /wp-json/webfusion-connector/v1/api-key/rotate
 *
 * Vygeneruje nový API klíč (pouze admin)
 *
 * Response: {
 *   "success": true,
 *   "api_key": "new_abc123...",
 *   "created_at": "2024-01-08 10:30:45",
 *   "message": "API key rotated successfully"
 * }
 */
function wbf_api_rotate_api_key(WP_REST_Request $request) {
    $result = wbf_connector_rotate_api_key();

    if (is_wp_error($result)) {
        return $result;
    }

    return new WP_REST_Response(array(
        'success' => true,
        'api_key' => $result,
        'created_at' => get_option('wbf_connector_api_key_created_at', ''),
        'message' => 'API key rotated successfully'
    ), 200);
}

/**
 * ENDPOINT: Ping endpoint pro rychlé ověření dostupnosti
 * GET /wp-json/webfusion-connector/v1/ping
 *
 * Rychlý endpoint pro ověření, že web a API funguje
 *
 * Headers: X-WBF-API-Key: {api_key}
 *
 * Response: {
 *   "success": true,
 *   "pong": true,
 *   "timestamp": 1234567890
 * }
 */
function wbf_api_ping(WP_REST_Request $request) {
    $auth = wbf_connector_verify_api_key($request);
    if (is_wp_error($auth)) {
        return $auth;
    }

    return new WP_REST_Response(array(
        'success' => true,
        'pong' => true,
        'timestamp' => time(),
        'site_url' => home_url()
    ), 200);
}

// Registrace všech endpointů
register_rest_route('webfusion-connector/v1', '/instant-login', array(
    'methods' => 'POST',
    'callback' => 'wbf_api_instant_login',
    'permission_callback' => '__return_true'
));

register_rest_route('webfusion-connector/v1', '/website-data', array(
    'methods' => 'GET',
    'callback' => 'wbf_api_website_data',
    'permission_callback' => '__return_true'
));

register_rest_route('webfusion-connector/v1', '/api-key', array(
    'methods' => 'GET',
    'callback' => 'wbf_api_get_api_key',
    'permission_callback' => '__return_true'
));

register_rest_route('webfusion-connector/v1', '/api-key/rotate', array(
    'methods' => 'POST',
    'callback' => 'wbf_api_rotate_api_key',
    'permission_callback' => '__return_true'
));

register_rest_route('webfusion-connector/v1', '/ping', array(
    'methods' => 'GET',
    'callback' => 'wbf_api_ping',
    'permission_callback' => '__return_true'
));
