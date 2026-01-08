<?php
/**
 * AJAX handlers pro plugin Webfusion connector – site status
 * Autor: Milan Vodák | Webfusion s.r.o.
 */

defined( 'ABSPATH' ) or die( 'Access denied' );

/* ------------------------------------------------------------------ */
/* 1) Ověření hesla pro deaktivaci                                    */
/* ------------------------------------------------------------------ */
add_action( 'wp_ajax_verify_deactivation_password', 'verify_deactivation_password' );
function verify_deactivation_password() {

    /** 1.1  capability */
    if ( ! current_user_can( 'activate_plugins' ) ) {
        wp_send_json_error( [ 'message' => 'Unauthorized' ] );
    }

    /** 1.2  pokud WordPress právě instaluje / upgrad­uje → bypass */
    if ( ( defined( 'WP_AUTO_UPDATE_CORE' ) && WP_AUTO_UPDATE_CORE )
         || ( defined( 'WP_INSTALLING' ) && WP_INSTALLING ) ) {
        wp_send_json_success();
    }

    /** 1.3  klasické ověření hesla */
    if ( isset( $_POST['deactivation_password'] )
         && $_POST['deactivation_password'] === DEACTIVATION_PASSWORD ) {
        wp_send_json_success();
    }

    wp_send_json_error( [ 'message' => 'Incorrect password' ] );
}

/* ------------------------------------------------------------------ */
/* 2) Deaktivace pluginu                                              */
/* ------------------------------------------------------------------ */
add_action( 'wp_ajax_deactivate_webfusion_plugin', 'deactivate_webfusion_plugin' );
function deactivate_webfusion_plugin() {

    if ( ! current_user_can( 'activate_plugins' ) ) {
        wp_send_json_error( [ 'message' => 'Unauthorized' ] );
    }

    /** 2.1  Bypass i zde při update / instalaci (stejné kritérium) */
    if ( ( defined( 'WP_AUTO_UPDATE_CORE' ) && WP_AUTO_UPDATE_CORE )
         || ( defined( 'WP_INSTALLING' ) && WP_INSTALLING ) ) {
        deactivate_plugins( 'webfusion-connector/web-status-feed.php' );
        wp_send_json_success( [ 'message' => 'Plugin deactivated (update context).' ] );
    }

    wp_send_json_error( [ 'message' => 'Deactivation forbidden – wrong context or no password.' ] );
}

/* ------------------------------------------------------------------ */
/* 3) Asynchronní regenerace XML feedu                                */
/* ------------------------------------------------------------------ */
add_action( 'wp_ajax_wbf_regenerate_feed_async',     'wbf_regenerate_feed_async' );
add_action( 'wp_ajax_nopriv_wbf_regenerate_feed_async', 'wbf_regenerate_feed_async' );
function wbf_regenerate_feed_async() {
    generate_and_write_xml();
    wp_send_json_success();
}

/* ------------------------------------------------------------------ */
/* 4) Test připojení k SMTP                                           */
/* ------------------------------------------------------------------ */
add_action( 'wp_ajax_wbf_test_smtp_connection',     'wbf_test_smtp_connection' );
add_action( 'wp_ajax_nopriv_wbf_test_smtp_connection', 'wbf_test_smtp_connection' );
function wbf_test_smtp_connection() {

    check_ajax_referer( 'wbf_test_smtp_ajax_nonce' );

    /* 4.1 Na webu je jiný SMTP plugin? → test nemá smysl. */
    $foreign_smtp = array_filter(
        get_option( 'active_plugins', [] ),
        fn( $p ) => stripos( $p, 'smtp' ) !== false && stripos( $p, 'webfusion-connector' ) === false
    );
    if ( $foreign_smtp ) {
        wp_send_json_error( 'Na webu je aktivní jiný SMTP plugin; test Webfusion SMTP nelze provést.' );
    }

    /* 4.2 Načteme PHPMailer */
    require_once ABSPATH . WPINC . '/PHPMailer/Exception.php';
    require_once ABSPATH . WPINC . '/PHPMailer/PHPMailer.php';
    require_once ABSPATH . WPINC . '/PHPMailer/SMTP.php';

    $mail   = new \PHPMailer\PHPMailer\PHPMailer( true );
    $mail->isSMTP();
    $custom = get_option( 'wbf_smtp_custom', false );

    if ( $custom ) {
        /* ---- Test VLASTNÍHO SMTP (hodnoty z formuláře) ---- */
        $mail->Host       = sanitize_text_field( $_POST['host'] );
        $mail->Port       = intval( $_POST['port'] );
        if ( ! empty( $_POST['encryption'] ) ) $mail->SMTPSecure = sanitize_text_field( $_POST['encryption'] );
        $mail->SMTPAuth   = true;
        $mail->Username   = sanitize_text_field( $_POST['user'] );
        $mail->Password   = sanitize_text_field( $_POST['pass'] );
        $mail->From       = sanitize_email( $_POST['from_email'] );
        $mail->FromName   = get_bloginfo( 'name' );
    } else {
        /* ---- Test VÝCHOZÍHO SMTP Webfusion ----------------- */
        $cfg              = wbf_get_default_smtp();
        $mail->Host       = $cfg['host'];
        $mail->Port       = $cfg['port'];
        $mail->SMTPSecure = $cfg['secure'];
        $mail->SMTPAuth   = true;
        $mail->Username   = $cfg['user'];
        $mail->Password   = $cfg['pass'];
        $mail->From       = $cfg['from'];
        $mail->FromName   = get_bloginfo( 'name' );
    }

    try {
        $mail->smtpConnect();
        wp_send_json_success( 'Připojení SMTP úspěšné.' );
    } catch ( \PHPMailer\PHPMailer\Exception $e ) {
        wp_send_json_error( 'Chyba připojení SMTP: ' . $e->getMessage() );
    }
}

/* ------------------------------------------------------------------ */
/* 5) Testovací e-mail                                                */
/* ------------------------------------------------------------------ */
add_action( 'wp_ajax_wbf_send_test_mail_ajax',     'wbf_send_test_mail_ajax' );
add_action( 'wp_ajax_nopriv_wbf_send_test_mail_ajax', 'wbf_send_test_mail_ajax' );
function wbf_send_test_mail_ajax() {

    check_ajax_referer( 'wbf_test_mail_ajax_nonce' );

    $foreign_smtp = array_filter(
        get_option( 'active_plugins', [] ),
        fn( $p ) => stripos( $p, 'smtp' ) !== false && stripos( $p, 'webfusion-connector' ) === false
    );
    if ( $foreign_smtp ) {
        wp_send_json_error( 'Testovací e-mail obsluhuje externí SMTP plugin.' );
    }

    $to   = sanitize_email( $_POST['recipient'] );
    $sent = wp_mail( $to, 'Testovací e-mail', 'Toto je testovací zpráva.' );

    if ( $sent ) {
        wp_send_json_success( 'E-mail odeslán.' );
    } else {
        wp_send_json_error( 'Chyba při odeslání e-mailu.' );
    }
}

/* ------------------------------------------------------------------ */
/* 6) Rotace API klíče                                                */
/* ------------------------------------------------------------------ */
add_action( 'wp_ajax_wbf_rotate_api_key_ajax', 'wbf_rotate_api_key_ajax' );
function wbf_rotate_api_key_ajax() {

    check_ajax_referer( 'wbf_rotate_api_key_nonce' );

    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Nemáte dostatečná oprávnění.' );
    }

    $new_key = wbf_connector_rotate_api_key();

    if ( is_wp_error( $new_key ) ) {
        wp_send_json_error( $new_key->get_error_message() );
    }

    wp_send_json_success( array(
        'api_key' => $new_key,
        'created_at' => get_option( 'wbf_connector_api_key_created_at', '' )
    ) );
}
?>
