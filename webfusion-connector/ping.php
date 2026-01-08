<?php
/**
 * Fast ping endpoint – SHORTINIT
 * Vrací „ok“ a spouští asynchronní přegenerování XML feedu.
 */

define( 'SHORTINIT', true );
require_once dirname( __FILE__, 4 ) . '/wp-load.php';   // ../../../../wp-load.php

/* ---------- okamžitá odpověď klientovi ---------- */
if ( ! defined( 'DONOTCACHEPAGE' ) ) define( 'DONOTCACHEPAGE', true );
header( 'Content-Type: text/plain; charset=utf-8' );
header( 'Cache-Control: no-cache, no-store, must-revalidate, max-age=0' );
header( 'Pragma: no-cache' );
header( 'Expires: 0' );
echo 'ok';

@ob_end_flush(); @flush();
if ( function_exists( 'fastcgi_finish_request' ) ) fastcgi_finish_request();

/* ---------- ručně spustíme AJAX bez funkcí WP_HTTP ---------- */
$ajax_url = ( ( ! empty( $_SERVER['HTTPS'] ) && $_SERVER['HTTPS'] !== 'off' ) ? 'https://' : 'http://' )
          . $_SERVER['HTTP_HOST']
          . '/wp-admin/admin-ajax.php';

if ( function_exists( 'curl_init' ) ) {
	$ch = curl_init( $ajax_url );
	curl_setopt_array( $ch, [
		CURLOPT_POST            => true,
		CURLOPT_POSTFIELDS      => http_build_query( [ 'action' => 'wbf_regenerate_feed_async' ] ),
		CURLOPT_RETURNTRANSFER  => false,
		CURLOPT_CONNECTTIMEOUT  => 1,
		CURLOPT_TIMEOUT         => 1,
		CURLOPT_SSL_VERIFYPEER  => false,
	] );
	curl_exec( $ch );
	curl_close( $ch );
} else {
	/* nouzově FALLBACK na file_get_contents; blokující max 1 s. */
	@file_get_contents( $ajax_url . '?action=wbf_regenerate_feed_async' );
}

/* konec – feed se generuje na pozadí */
