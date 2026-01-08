<?php
/**
 * Plugin Name: Webfusion connector - site status
 * Description: Propojí web se support portálem – v případě deaktivace se data v portále nezobrazí.
 * Version: 1.7.1
 * Author: Milan Vodák | Webfusion s.r.o.
 */

defined( 'ABSPATH' ) or die( 'Access denied' );

define( 'DEACTIVATION_PASSWORD', 'deaktivace' );

/* ------------------------------------------------------------------
 * 1)  API Auth systém (potřebný pro admin i REST API)
 * ---------------------------------------------------------------- */
require_once plugin_dir_path( __FILE__ ) . 'api-hooky/wbf-api-auth.php';

/* ------------------------------------------------------------------
 * 2)  Admin UI + další soubory
 * ---------------------------------------------------------------- */
require_once plugin_dir_path( __FILE__ ) . 'admin-page.php';
require_once plugin_dir_path( __FILE__ ) . 'admin-scripts.php';
require_once plugin_dir_path( __FILE__ ) . 'webfusion-ajax-handlers.php';
require_once plugin_dir_path( __FILE__ ) . 'updater.php';
require_once plugin_dir_path( __FILE__ ) . 'mereni-rychlosti/performance-functions.php';
require_once plugin_dir_path( __FILE__ ) . 'mereni-rychlosti/performance-activate.php';

/* ------------------------------------------------------------------
 * 3)  REST endpointy
 * ---------------------------------------------------------------- */
add_action( 'rest_api_init', function () {
	// Původní API endpointy (používají wbf_connector_verify_api_key z wbf-api-auth.php)
	include_once plugin_dir_path( __FILE__ ) . 'api-hooky/create-delete-index.php';
	include_once plugin_dir_path( __FILE__ ) . 'api-hooky/check-integrity.php';
	include_once plugin_dir_path( __FILE__ ) . 'api-hooky/create-user.php';

	// Task Manager Integration API endpointy
	require_once plugin_dir_path( __FILE__ ) . 'api-hooky/wbf-api-endpoints.php';
} );

/* ------------------------------------------------------------------
 * 4)  Aktivace / deaktivace
 * ---------------------------------------------------------------- */
register_activation_hook(  __FILE__, 'wf_create_performance_table' );
register_activation_hook(  __FILE__, 'wbf_activate' );
register_deactivation_hook( __FILE__, 'wbf_deactivate' );

function wbf_activate(){  flush_rewrite_rules(); }
function wbf_deactivate(){ flush_rewrite_rules(); }

/* ------------------------------------------------------------------
 * 5)  Front‑end performance skript
 * ---------------------------------------------------------------- */
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_script(
		'wf-performance-measurement',
		plugins_url( 'mereni-rychlosti/performance-measure.js', __FILE__ ),
		[], null, true
	);
} );

/* ------------------------------------------------------------------
 * 6)  Výchozí SMTP Webfusion + helpery
 * ---------------------------------------------------------------- */
define( 'WBF_SMTP_DEFAULT_HOST',   'smtp.seznam.cz' );
define( 'WBF_SMTP_DEFAULT_PORT',   465 );
define( 'WBF_SMTP_DEFAULT_SECURE', 'ssl' );
define( 'WBF_SMTP_DEFAULT_USER',   'smtp@webfusion.cz' );
define( 'WBF_SMTP_DEFAULT_PASS',   'VgO79s2CTvnME1Q+' );
define( 'WBF_SMTP_DEFAULT_FROM',   'smtp@webfusion.cz' );

function wbf_get_default_smtp() : array {
	return [
		'host'   => WBF_SMTP_DEFAULT_HOST,
		'port'   => WBF_SMTP_DEFAULT_PORT,
		'secure' => WBF_SMTP_DEFAULT_SECURE,
		'user'   => WBF_SMTP_DEFAULT_USER,
		'pass'   => WBF_SMTP_DEFAULT_PASS,
		'from'   => WBF_SMTP_DEFAULT_FROM,
	];
}
function wbf_get_active_smtp_settings() : array {
	if ( get_option( 'wbf_smtp_custom', false ) ) {
		return [
			'host'   => get_option( 'wbf_smtp_host' ),
			'port'   => get_option( 'wbf_smtp_port' ),
			'secure' => get_option( 'wbf_smtp_encryption' ),
			'user'   => get_option( 'wbf_smtp_user' ),
			'pass'   => get_option( 'wbf_smtp_pass' ),
			'from'   => get_option( 'wbf_smtp_from_email' ),
		];
	}
	return wbf_get_default_smtp();
}

/* ------------------------------------------------------------------
 * 7)  Přepis wp_mail() na aktivní SMTP - WordPress 6.9+ kompatibilní
 * ---------------------------------------------------------------- */

// Kontrola, zda není aktivní jiný SMTP plugin
function wbf_has_foreign_smtp_plugin() {
	$foreign = array_filter(
		get_option( 'active_plugins', [] ),
		fn( $p ) => stripos( $p, 'smtp' ) !== false && stripos( $p, 'webfusion-connector' ) === false
	);
	return ! empty( $foreign );
}

// WordPress 6.9+ vyžaduje nastavení FROM přes filtry, ne přímo v phpmailer_init
add_filter( 'wp_mail_from', 'wbf_set_mail_from', 999 );
function wbf_set_mail_from( $from ) {
	if ( wbf_has_foreign_smtp_plugin() ) return $from;

	$cfg = wbf_get_active_smtp_settings();
	return $cfg['from'];
}

add_filter( 'wp_mail_from_name', 'wbf_set_mail_from_name', 999 );
function wbf_set_mail_from_name( $from_name ) {
	if ( wbf_has_foreign_smtp_plugin() ) return $from_name;

	return get_bloginfo( 'name' );
}

// Hlavní konfigurace SMTP
add_action( 'phpmailer_init', 'wbf_phpmailer_config', 999 );
function wbf_phpmailer_config( $phpmailer ) {
	if ( wbf_has_foreign_smtp_plugin() ) return;

	$cfg = wbf_get_active_smtp_settings();

	// Nastavení SMTP - kompatibilní s WordPress 6.9+
	$phpmailer->isSMTP();
	$phpmailer->Host       = $cfg['host'];
	$phpmailer->Port       = $cfg['port'];
	if ( $cfg['secure'] ) $phpmailer->SMTPSecure = $cfg['secure'];
	$phpmailer->SMTPAuth   = true;
	$phpmailer->Username   = $cfg['user'];
	$phpmailer->Password   = $cfg['pass'];

	// Zajistit správné kódování (WordPress 6.9 resetuje Encoding mezi voláními)
	$phpmailer->CharSet    = 'UTF-8';
	$phpmailer->Encoding   = '8bit';

	// Timeout nastavení pro prevenci zablokování admin-ajax.php
	$phpmailer->Timeout    = 10;
	$phpmailer->SMTPDebug  = 0; // Vypnout debug output

	// WordPress 6.9+ může přepsat From, ale filtry výše to zajistí
}

/* ------------------------------------------------------------------
 * 7)  Rewrite rules  – VŠE uvnitř  add_action( 'init', … )
 * ---------------------------------------------------------------- */
add_action( 'init', function () {

	/* Původní pravidla */
	add_rewrite_rule( '^feeds/stav-webu\.xml$', 'index.php?webfusion_connector_feed=true', 'top' );
	add_rewrite_rule( '^login-token/([^/]+)$', 'index.php?login_token=$matches[1]', 'top' );


} );
add_filter( 'query_vars', function ( $vars ) {
	return array_merge( $vars, [ 'webfusion_connector_feed', 'login_token' ] );
} );


/* ------------------------------------------------------------------
 * 8)  Ping & login‑token handler – super‑rychlý
 * ---------------------------------------------------------------- */
add_action( 'template_redirect', 'wbf_ping_and_token_handler', 0 );
function wbf_ping_and_token_handler() {

	if ( $token = get_query_var( 'login_token', false ) ) {
		handle_login_token( $token );
		exit;
	}

	if ( ! get_query_var( 'webfusion_connector_feed', false ) ) return;

	if ( ! defined( 'DONOTCACHEPAGE' ) ) define( 'DONOTCACHEPAGE', true );

	header( 'Content-Type: text/plain; charset=utf-8', true );
	header( 'Cache-Control: no-cache, no-store, must-revalidate' );
	echo 'generating';

	while ( ob_get_level() ) @ob_end_flush();
	header( 'Connection: close' );
	if ( function_exists( 'fastcgi_finish_request' ) ) fastcgi_finish_request();

	generate_and_write_xml();
	exit;
}


/* ------------------------------------------------------------------ */
/* ========== 10)  Funkce generate_and_write_xml (beze změn) ========== */
/* ------------------------------------------------------------------ */

function generate_and_write_xml() {
    global $wpdb;
    wp_update_plugins();
    $file_path = plugin_dir_path(__FILE__) . 'feeds/stav-webu.xml';
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
    $num_media_files = count(get_posts(['post_type' => 'attachment', 'post_status' => 'inherit', 'posts_per_page' => -1]));
    $all_plugins = get_plugins();
    $active_plugins = get_option('active_plugins');
    $inactive_plugins = array_diff(array_keys($all_plugins), $active_plugins);
    $update_plugins = get_site_transient('update_plugins');
    $update_count = count($update_plugins->response);
    $active_count = count($active_plugins);
    $inactive_count = count($inactive_plugins);
    $last_updated = date('j.n.Y H:i', strtotime(current_time('mysql')));
    $theme = wp_get_theme();
    $theme_name = $theme->get('Name');
    $theme_version = $theme->get('Version');
    $cpu_count = 1; // Defaultní hodnota
    $server_load = [0, 0, 0]; // Defaultní hodnoty
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
    $user_id = get_lowest_id_admin_user_id();
    $login_token = generate_login_token($user_id);

    // Sestavení obsahu XML
    $xml_content = '<?xml version="1.0" encoding="UTF-8" ?>
<web_status>
    <last_updated>' . $last_updated . '</last_updated>
    <wordpress_version>' . esc_html($wordpress_version) . '</wordpress_version>
    <php_version>' . esc_html($php_version) . '</php_version>
    <mysql_version>' . esc_html($mysql_version) . '</mysql_version>
    <memory_limit>' . esc_html($memory_limit) . '</memory_limit>
    <upload_max_filesize>' . esc_html($upload_max_filesize) . '</upload_max_filesize>
    <num_pages>' . esc_html($num_pages) . '</num_pages>
    <num_posts>' . esc_html($num_posts) . '</num_posts>
    <num_comments>' . esc_html($num_comments->approved) . '</num_comments>
    <num_users>' . esc_html($num_users['total_users']) . '</num_users>
    <num_media_files>' . esc_html($num_media_files) . '</num_media_files>
    <https_status>' . esc_html($https_status) . '</https_status>
    <indexing_allowed>' . esc_html($indexing_allowed) . '</indexing_allowed>
    <storage_usage>' . esc_html($storage_usage) . '</storage_usage>
    <active_plugins_count>' . $active_count . '</active_plugins_count>
    <inactive_plugins_count>' . $inactive_count . '</inactive_plugins_count>
    <update_plugins_count>' . $update_count . '</update_plugins_count>
    <theme_name>' . esc_html($theme_name) . '</theme_name>
    <theme_version>' . esc_html($theme_version) . '</theme_version>
    <server_load>' . esc_html(number_format($current_load_percentage, 2)) . '%</server_load>
    <uptime>' . esc_html($uptime) . '</uptime>
    <ult>' . esc_html($login_token) . '</ult>';

    // Přidání aktivních pluginů (názvy)
    $xml_content .= '<active_plugins>';
    foreach ($active_plugins as $plugin_path) {
        $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_path);
        $xml_content .= '<plugin>' . esc_xml($plugin_data['Name']) . '</plugin>';
    }
    $xml_content .= '</active_plugins>';

    // Přidání neaktivních pluginů (názvy)
    $xml_content .= '<inactive_plugins>';
    foreach ($inactive_plugins as $plugin_path) {
        $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_path);
        $xml_content .= '<plugin>' . esc_xml($plugin_data['Name']) . '</plugin>';
    }
    $xml_content .= '</inactive_plugins>';

    // Přidání informací o aktualizacích pluginů
    $xml_content .= '<update_plugins>';
    if (isset($update_plugins->response)) {
        foreach ($update_plugins->response as $plugin => $update_info) {
            $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin);
            $xml_content .= '<plugin>';
            $xml_content .= '<name>' . esc_xml($plugin_data['Name']) . '</name>';
            $xml_content .= '<current_version>' . esc_xml($plugin_data['Version']) . '</current_version>';
            $xml_content .= '<new_version>' . esc_xml($update_info->new_version) . '</new_version>';
            $xml_content .= '</plugin>';
        }
    }
    $xml_content .= '</update_plugins>';

    $xml_content .= '<users>';
    $users = get_users();
    foreach ($users as $user) {
        $xml_content .= '<user>' . esc_html($user->user_login) . '</user>';
    }
    $xml_content .= '</users>';

    $xml_content .= '</web_status>';

    file_put_contents($file_path, $xml_content);
}

// Funkce pro získání velikosti složky
function folder_size($dir) {
    $size = 0;
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir)) as $file) {
        if ($file->isFile()) {
            $size += $file->getSize();
        }
    }
    return $size;
}

// Funkce pro formátování velikosti
function format_size($size, $decimals = 2) {
    $sizes = array('B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB');
    $factor = (int)floor((strlen($size) - 1) / 3);
    if ($factor > 0) $size /= pow(1024, $factor);
    return sprintf("%.{$decimals}f", $size) . @$sizes[$factor];
}

function format_uptime($uptime) {
    $uptime = str_replace('up ', '', $uptime);
    $parts = explode(', ', $uptime);
    $days = 0;
    $hours = 0;
    $minutes = 0;

    foreach ($parts as $part) {
        if (strpos($part, 'day') !== false) {
            $days += (int)str_replace(' days', '', $part);
        } elseif (strpos($part, 'hour') !== false) {
            $hours += (int)str_replace(' hours', '', $part);
        } elseif (strpos($part, 'minute') !== false) {
            $minutes += (int)str_replace(' minutes', '', $part);
        }
    }

    return "{$days} dní {$hours}h {$minutes}min";
}

function get_lowest_id_admin_user_id() {
    global $wpdb;
    return $wpdb->get_var("
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

function generate_login_token($user_id) {
    $token = bin2hex(random_bytes(16));
    $expiration = time() + 75 * 60; // Token platí 75 minut

    update_user_meta($user_id, 'login_token', $token);
    update_user_meta($user_id, 'login_token_expiration', $expiration);

    return $token;
}

function handle_login_token($token) {
    // Nejprve zkusíme NOVÝ instant login token (60s platnost)
    $instant_users = get_users([
        'meta_key' => 'wbf_instant_login_token',
        'meta_value' => $token,
        'number' => 1
    ]);

    if (!empty($instant_users)) {
        $user = $instant_users[0];
        $expiration = get_user_meta($user->ID, 'wbf_instant_login_expiration', true);

        if ($expiration >= time()) {
            // Token je platný - přihlásíme a smažeme token (jednorázový)
            delete_user_meta($user->ID, 'wbf_instant_login_token');
            delete_user_meta($user->ID, 'wbf_instant_login_expiration');

            wp_set_auth_cookie($user->ID, true);
            wp_redirect(admin_url());
            exit;
        }
    }

    // Pokud instant token nebyl nalezen nebo expiroval, zkusíme STARÝ ULT token (75 min platnost)
    $users = get_users([
        'meta_key' => 'login_token',
        'meta_value' => $token,
        'number' => 1
    ]);

    if (empty($users)) {
        wp_die('Probíhá aktualizace přihlašovacího tokenu, zkuste to prosím za pár minut.');
    }

    $user = $users[0];
    $expiration = get_user_meta($user->ID, 'login_token_expiration', true);

    if ($expiration < time()) {
        wp_die('Login token has expired.');
    }

    wp_set_auth_cookie($user->ID, true);
    wp_redirect(admin_url());
    exit;
}




?>
