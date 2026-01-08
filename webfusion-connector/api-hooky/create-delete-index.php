<?php
/**
 * API endpointy pro vytváření/mazání index.html (pozastavení webu)
 * Používá centrální auth systém z wbf-api-auth.php
 */

function wbf_connector_clear_cache() {
    if (function_exists('wp_cache_clear_cache')) {
        // WP Super Cache
        wp_cache_clear_cache();
    } elseif (function_exists('w3tc_flush_all')) {
        // W3 Total Cache
        w3tc_flush_all();
    } elseif (function_exists('rocket_clean_domain')) {
        // WP Rocket
        rocket_clean_domain();
    } else {
        // Přidej další metody pro vymazání cache podle pluginu/systému, který používáš.
        return new WP_REST_Response('Cache plugin not detected or not supported', 500);
    }
}

function wbf_connector_create_index_html(WP_REST_Request $request) {
    $auth = wbf_connector_verify_api_key($request);
    if (is_wp_error($auth)) {
        return $auth;
    }

    $index_html_path = ABSPATH . 'index.html';
    $content = '<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web pozastaven</title>
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans&display=swap" rel="stylesheet">
    <style>
        body {
            background-color: #323539;
            color: #ffffff;
            font-family: "Open Sans", sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
        }
		
		a {
			color: #239a93;
			font-family: "Open Sans", sans-serif;
		}
		
        img {
            max-width: 100%;
            height: auto;
        }
        .container {
            max-width: 600px;
            padding: 20px;
        }
        h1 {
            margin: 20px 0;
			font-size: 60px;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://portal.webfusion.cz/wp-content/uploads/2024/08/web-pozastaven.png" alt="Web pozastaven">
        <h1>Web je pozastaven</h1>
        <p>Prosím kontaktujte <a href="mailto:fakturace@webfusion.cz">fakturace@webfusion.cz</a></p>
    </div>
</body>
</html>';

    // Kontrola, zda index.html již existuje
    if (file_exists($index_html_path)) {
        return new WP_REST_Response('index.html already exists', 200);
    }

    // Vytvoření souboru index.html
    if (file_put_contents($index_html_path, $content)) {
        wbf_connector_clear_cache(); // Vymazání cache po úspěšné operaci
        return new WP_REST_Response('index.html created and cache cleared successfully', 200);
    } else {
        return new WP_REST_Response('Failed to create index.html', 500);
    }
}

function wbf_connector_delete_index_html(WP_REST_Request $request) {
    $auth = wbf_connector_verify_api_key($request);
    if (is_wp_error($auth)) {
        return $auth;
    }

    $index_html_path = ABSPATH . 'index.html';

    // Kontrola, zda index.html neexistuje
    if (!file_exists($index_html_path)) {
        return new WP_REST_Response('index.html does not exist', 404);
    }

    // Smazání souboru index.html
    if (unlink($index_html_path)) {
        wbf_connector_clear_cache(); // Vymazání cache po úspěšné operaci
        return new WP_REST_Response('index.html deleted and cache cleared successfully', 200);
    } else {
        return new WP_REST_Response('Failed to delete index.html', 500);
    }
}

register_rest_route('webfusion-connector/v1', '/create-index', array(
    'methods' => 'POST',
    'callback' => 'wbf_connector_create_index_html',
));

register_rest_route('webfusion-connector/v1', '/delete-index', array(
    'methods' => 'POST',
    'callback' => 'wbf_connector_delete_index_html',
));
