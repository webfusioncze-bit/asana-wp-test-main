<?php
/**
 * Admin page pro Webfusion Connector - Site Status
 * Autor: Milan Vodák | Webfusion s.r.o.
 */

defined('ABSPATH') or die('Access denied');
include_once ABSPATH . 'wp-admin/includes/plugin.php';

// Registrace menu
add_action('admin_menu','wbf_connector_admin_menu');
function wbf_connector_admin_menu(){
    add_menu_page(
        'WBF connector',
        'WBF connector',
        'manage_options',
        'wbf-connector',
        'wbf_site_status_page',
        'dashicons-networking',
        60
    );
}

function wbf_site_status_page(){
    if(!current_user_can('manage_options')) wp_die('Nemáte dostatečná oprávnění.');

    echo '<div class="wrap">';

    // 1) Skrýt WP notices
    echo '<style>.notice{display:none!important;}</style>';

    // 2) Hlavička s logem, barvou, názvem, verzí, popiskem
    $main_file = plugin_dir_path(__FILE__) . 'web-status-feed.php';
    $meta = get_file_data( $main_file, [
        'Name'        => 'Plugin Name',
        'Version'     => 'Version',
        'Description' => 'Description',
    ] );
    echo '<div style="display:flex;align-items:center;background:#23282d;padding:12px 20px;margin-bottom:20px;">';
      echo '<img src="https://webfusion.cz/wp-content/uploads/2021/02/webfusion-logo-white-com.png"';
           echo ' alt="Webfusion" style="height:25px;margin-right:12px;">';
      echo '<div>';
        echo '<div style="color:#fff;font-size:1.4em;font-weight:500;">' . esc_html($meta['Name']) . '</div>';
        echo '<div style="color:#bbb;font-size:0.9em;">verze '
             . esc_html($meta['Version'])
             . ' – '
             . esc_html($meta['Description'])
             . '</div>';
      echo '</div>';
    echo '</div>';

    // 3) Zpracování POST‑akcí (regenerace, ukládání SMTP)
    $msgs = [];
    if(isset($_POST['wbf_regenerate_feed'])){
        check_admin_referer('wbf_regen_feed_nonce','wbf_regen_feed_nonce');
        generate_and_write_xml();
        $msgs[] = ['type'=>'success','text'=>'Feed regenerován. Token se propíše v 6. minutě každé hodiny.'];
    }
    if(isset($_POST['wbf_save_smtp_settings'])){
        check_admin_referer('wbf_smtp_settings_nonce','wbf_smtp_settings_nonce');
        $custom = isset($_POST['wbf_smtp_custom']);
        update_option('wbf_smtp_custom', $custom);
        if($custom){
            update_option('wbf_smtp_host',       sanitize_text_field($_POST['wbf_smtp_host']));
            update_option('wbf_smtp_port',       intval($_POST['wbf_smtp_port']));
            update_option('wbf_smtp_encryption', sanitize_text_field($_POST['wbf_smtp_encryption']));
            update_option('wbf_smtp_user',       sanitize_text_field($_POST['wbf_smtp_user']));
            update_option('wbf_smtp_pass',       sanitize_text_field($_POST['wbf_smtp_pass']));
            update_option('wbf_smtp_from_email', sanitize_email($_POST['wbf_smtp_from_email']));
        }
        $msgs[] = ['type'=>'success','text'=>'SMTP nastavení uloženo.'];
    }

    // 4) Načtení dat z XML feedu
    $xml_file = plugin_dir_path(__FILE__).'feeds/stav-webu.xml';
    if(file_exists($xml_file)){
        $xml       = simplexml_load_file($xml_file);
        $last      = (string)$xml->last_updated;
        $dt        = DateTime::createFromFormat('j.n.Y H:i',$last);
        $age       = round((current_time('timestamp') - $dt->getTimestamp())/60) . ' min';
        $feed_ok   = (current_time('timestamp') - $dt->getTimestamp()) <= 75*60;
        $token_str = (string)$xml->ult;
    } else {
        $last=$age='–'; $feed_ok=false; $token_str='–';
    }

    // 5) Zjištění současného stavu WordPress
    $cur      = get_bloginfo('version');
    $upd      = get_site_transient('update_core');
    $new      = $upd->updates[0]->version ?? null;
    $active   = get_option('active_plugins', []);
    $conf     = array_filter($active, fn($p)=>stripos($p,'smtp')!==false);
    $has_conf = !empty($conf);
    $custom   = get_option('wbf_smtp_custom', false);

    // 6) Notices
    foreach($msgs as $m){
        printf(
            '<div class="notice notice-%1$s is-dismissible"><p>%2$s</p></div>',
            esc_attr($m['type']), esc_html($m['text'])
        );
    }

    // 7) Záložky
    ?>
    <h2 class="nav-tab-wrapper">
      <a href="#tab-status" class="nav-tab nav-tab-active">Status</a>
      <a href="#tab-info"   class="nav-tab">Informace</a>
      <a href="#tab-smtp"   class="nav-tab">SMTP</a>
      <a href="#tab-test"   class="nav-tab">Test e‑mail</a>
      <a href="#tab-api"    class="nav-tab">API klíč</a>
      <a href="#tab-tools"  class="nav-tab">Nástroje</a>
    </h2>

    <style>
      .wbf-card{background:#fff;border:1px solid #e1e1e1;border-radius:4px;padding:16px;margin:20px 0;}
      .wbf-card h2{margin-top:0;color:#0073aa;border-bottom:1px solid #e1e1e1;padding-bottom:8px;}
      .wbf-badge{display:inline-block;padding:2px 6px;border-radius:3px;color:#fff;font-size:.9em;}
      .wbf-badge--ok{background:#46b450;} .wbf-badge--fail{background:#dc3232;}
      .wbf-switch{position:relative;display:inline-block;width:50px;height:24px;}
      .wbf-switch input{opacity:0;width:0;height:0;}
      .wbf-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
                  background:#ccc;transition:.4s;border-radius:24px;}
      .wbf-slider:before{position:absolute;content:"";height:18px;width:18px;
                         left:3px;bottom:3px;background:#fff;transition:.4s;border-radius:50%;}
      .wbf-switch input:checked + .wbf-slider{background:#0073aa;}
      .wbf-switch input:checked + .wbf-slider:before{transform:translateX(26px);}
      .wbf-tab-content{display:none;} .wbf-tab-active{display:block;}
    </style>

    <script>
    jQuery(function($){
      // Taby
      $('.nav-tab').click(function(e){
        e.preventDefault();
        $('.nav-tab').removeClass('nav-tab-active');
        $(this).addClass('nav-tab-active');
        $('.wbf-tab-content').removeClass('wbf-tab-active');
        $($(this).attr('href')).addClass('wbf-tab-active');
      });
      // Toggle SMTP polí
      $('#wbf_smtp_toggle').change(function(){
        $('.wbf-smtp-row').toggle(this.checked);
      });
      // AJAX test SMTP
      $('#wbf_test_smtp').click(function(e){
        e.preventDefault();
        var data = {
          action: 'wbf_test_smtp_connection',
          host:      $('#wbf_smtp_host').val(),
          port:      $('#wbf_smtp_port').val(),
          encryption:$('#wbf_smtp_encryption').val(),
          user:      $('#wbf_smtp_user').val(),
          pass:      $('#wbf_smtp_pass').val(),
          from_email:$('#wbf_smtp_from_email').val(),
          _ajax_nonce: '<?php echo wp_create_nonce('wbf_test_smtp_ajax_nonce'); ?>'
        };
        $.post(ajaxurl, data, function(resp){
          alert(resp.success ? resp.data : resp.data);
        });
      });
      // AJAX test e‑mail
      $('#wbf_send_test_mail_btn').click(function(e){
        e.preventDefault();
        var recipient = $('#wbf_test_mail_recipient').val().trim();
        if(!recipient){ alert('Zadejte e‑mail!'); return; }
        $.post(ajaxurl, {
          action: 'wbf_send_test_mail_ajax',
          recipient: recipient,
          _ajax_nonce: '<?php echo wp_create_nonce('wbf_test_mail_ajax_nonce'); ?>'
        }, function(resp){
          alert(resp.success ? resp.data : resp.data);
        });
      });
      // Kopírovat API klíč
      $('#wbf_copy_api_key').click(function(e){
        e.preventDefault();
        var apiKeyInput = document.getElementById('wbf_api_key_value');
        apiKeyInput.select();
        document.execCommand('copy');
        $(this).text('Zkopírováno!').prop('disabled', true);
        setTimeout(function(){
          $('#wbf_copy_api_key').text('Kopírovat').prop('disabled', false);
        }, 2000);
      });
      // Rotovat API klíč
      $('#wbf_rotate_api_key').click(function(e){
        e.preventDefault();
        if(!confirm('Opravdu chcete vygenerovat nový API klíč? Starý klíč přestane fungovat a Task Manager bude potřeba aktualizovat.')){ return; }
        var btn = $(this);
        btn.prop('disabled', true).text('Generuji...');
        $.post(ajaxurl, {
          action: 'wbf_rotate_api_key_ajax',
          _ajax_nonce: '<?php echo wp_create_nonce('wbf_rotate_api_key_nonce'); ?>'
        }, function(resp){
          if(resp.success){
            $('#wbf_api_key_value').val(resp.data.api_key);
            alert('Nový API klíč byl vygenerován. Nezapomeňte ho aktualizovat v Task Manager aplikaci.');
            location.reload();
          } else {
            alert('Chyba: ' + resp.data);
          }
        }).always(function(){
          btn.prop('disabled', false).text('Vygenerovat nový klíč');
        });
      });
    });
    </script>

    <!-- TAB: Status -->
    <div id="tab-status" class="wbf-tab-content wbf-tab-active">
      <div class="wbf-card">
        <h2>Feed &amp; Token</h2>
        <p><strong>Feed:</strong>
          <?php echo $last==='–'
            ? 'nenalezen'
            : esc_html($last).' ('.esc_html($age).') — '
              .'<span class="wbf-badge '.($feed_ok?'wbf-badge--ok':'wbf-badge--fail').'">'
              .($feed_ok?'platný':'neplatný').'</span>'; ?>
        </p>
        <p><strong>Aktuální token:</strong> <code><?php echo esc_html($token_str); ?></code></p>
      </div>
      <div class="wbf-card">
        <h2>WordPress verze</h2>
        <p><strong>Aktuální:</strong> <?php echo esc_html($cur); ?></p>
        <p><strong>Dostupná:</strong>
          <?php if($new && version_compare($new,$cur,'>')): ?>
            <span class="wbf-badge wbf-badge--ok"><?php echo esc_html($new); ?></span>
          <?php else: ?>
            <span class="wbf-badge wbf-badge--ok">žádná nová</span>
          <?php endif;?>
        </p>
      </div>
    </div>

    <!-- TAB: Informace -->
    <div id="tab-info" class="wbf-tab-content">
      <div class="wbf-card">
        <h2>Parametry webu (XML)</h2>
        <?php if(isset($xml)): ?>
        <table class="form-table">
          <?php
          $labels=[
            'wordpress_version'=>'Verze WP','php_version'=>'Verze PHP','mysql_version'=>'Verze MySQL',
            'memory_limit'=>'Limit paměti','upload_max_filesize'=>'Max. upload','num_pages'=>'Stránek',
            'num_posts'=>'Příspěvků','num_comments'=>'Komentářů','num_users'=>'Uživatelů',
            'num_media_files'=>'Mediálních','https_status'=>'HTTPS','indexing_allowed'=>'Indexování',
            'storage_usage'=>'Úložiště'
          ];
          foreach($labels as $tag=>$lab): ?>
          <tr>
            <th><?php echo esc_html($lab); ?></th>
            <td><?php echo esc_html($xml->$tag); ?></td>
          </tr>
          <?php endforeach; ?>
        </table>
        <?php else: ?><p>XML feed nenalezen.</p><?php endif;?>
      </div>
    </div>

    <!-- TAB: SMTP -->
    <div id="tab-smtp" class="wbf-tab-content">
      <div class="wbf-card">
        <h2>SMTP nastavení</h2>
        <p><strong>Aktuální režim:</strong>
          <?php
          echo $has_conf
            ? 'Externí SMTP plugin aktivní: '.implode(', ',$conf)
            : ($custom?'Vlastní SMTP':'Webfusion SMTP (výchozí)');
          ?>
        </p>
        <form>
          <table class="form-table">
            <tr>
              <th>Přepnout vlastní SMTP</th>
              <td>
                <label class="wbf-switch">
                  <input type="checkbox" id="wbf_smtp_toggle" name="wbf_smtp_custom"
                         value="1" <?php checked($custom); ?> <?php disabled($has_conf); ?>>
                  <span class="wbf-slider"></span>
                </label>
              </td>
            </tr>
            <?php
            $fields = [
              'host'=>'Host','port'=>'Port',
              'encryption'=>'Šifrování','user'=>'Uživatel',
              'pass'=>'Heslo','from_email'=>'From e‑mail'
            ];
            foreach($fields as $key=>$label):
              $type = $key==='port' ? 'number' : ($key==='encryption'?'select':'text');
            ?>
            <tr class="wbf-smtp-row" style="display:<?php echo $custom?'table-row':'none';?>;">
              <th><?php echo $label; ?></th>
              <td>
                <?php if($type==='select'): ?>
                  <select id="wbf_smtp_encryption" name="wbf_smtp_encryption">
                    <option value=""   <?php selected(get_option('wbf_smtp_encryption'),'');?>>Žádné</option>
                    <option value="ssl"<?php selected(get_option('wbf_smtp_encryption'),'ssl');?>>SSL</option>
                    <option value="tls"<?php selected(get_option('wbf_smtp_encryption'),'tls');?>>TLS</option>
                  </select>
                <?php else: ?>
                  <input
                    id="wbf_smtp_<?php echo $key;?>"
                    name="wbf_smtp_<?php echo $key;?>"
                    type="<?php echo $type;?>"
                    class="<?php echo in_array($key,['host','user','pass','from_email'])?'regular-text':'small-text';?>"
                    value="<?php echo esc_attr(get_option('wbf_smtp_'.$key));?>"
                  >
                <?php endif;?>
              </td>
            </tr>
            <?php endforeach;?>
          </table>
          <p>
            <button type="button" id="wbf_test_smtp" class="button button-secondary"
              <?php disabled($has_conf);?>>Testovat připojení</button>
            <button type="submit" name="wbf_save_smtp_settings"
              class="button button-primary" <?php disabled($has_conf);?>>Uložit</button>
          </p>
        </form>
      </div>
    </div>

    <!-- TAB: Test e‑mail -->
    <div id="tab-test" class="wbf-tab-content">
      <div class="wbf-card">
        <h2>Testovací e‑mail</h2>
        <table class="form-table">
          <tr>
            <th>Příjemce</th>
            <td><input type="email" id="wbf_test_mail_recipient" class="regular-text"></td>
          </tr>
        </table>
        <p><button id="wbf_send_test_mail_btn" class="button">Odeslat</button></p>
      </div>
    </div>

    <!-- TAB: API klíč -->
    <div id="tab-api" class="wbf-tab-content">
      <div class="wbf-card">
        <h2>API klíč pro Task Manager</h2>
        <p>
          API klíč umožňuje Task Manager aplikaci přistupovat k tomuto webu.
          <br>Používá se pro okamžité přihlášení a získávání aktuálních dat bez závislosti na XML feedu.
        </p>
        <?php
        $api_key = get_option('wbf_connector_api_key', '');
        $api_created = get_option('wbf_connector_api_key_created_at', '');

        if (empty($api_key)) {
          wbf_connector_init_api_key();
          $api_key = get_option('wbf_connector_api_key', '');
          $api_created = get_option('wbf_connector_api_key_created_at', '');
        }
        ?>
        <table class="form-table">
          <tr>
            <th>Aktuální API klíč</th>
            <td>
              <input
                type="text"
                id="wbf_api_key_value"
                class="regular-text"
                value="<?php echo esc_attr($api_key); ?>"
                readonly
                style="font-family:monospace;background:#f9f9f9;"
              >
              <button type="button" id="wbf_copy_api_key" class="button">Kopírovat</button>
            </td>
          </tr>
          <tr>
            <th>Vytvořeno</th>
            <td><?php echo $api_created ? esc_html($api_created) : '–'; ?></td>
          </tr>
          <tr>
            <th>API endpointy</th>
            <td>
              <code><?php echo esc_html(home_url('/wp-json/webfusion-connector/v1/')); ?></code>
              <br><br>
              <strong>Dostupné endpointy:</strong>
              <ul style="margin-left:20px;">
                <li><code>GET /ping</code> - Test dostupnosti</li>
                <li><code>POST /instant-login</code> - Okamžité přihlášení</li>
                <li><code>GET /website-data</code> - Real-time data o webu</li>
              </ul>
            </td>
          </tr>
        </table>
        <p>
          <button type="button" id="wbf_rotate_api_key" class="button button-secondary">
            Vygenerovat nový klíč
          </button>
          <span style="color:#999;margin-left:10px;">
            (Starý klíč přestane fungovat)
          </span>
        </p>
      </div>
    </div>

    <!-- TAB: Nástroje -->
    <div id="tab-tools" class="wbf-tab-content">
      <div class="wbf-card">
        <h2>Kontrola integrity jádra</h2>
        <form method="post">
          <?php wp_nonce_field('wbf_int_nonce','wbf_int_nonce'); ?>
          <button name="wbf_check_integrity" class="button">Spustit kontrolu</button>
        </form>
        <?php if(isset($issues)): ?>
          <p><strong><?php echo esc_html($summary); ?></strong></p>
          <?php if($summary!=='Jádro WP je v pořádku.'): ?>
            <details style="margin-top:8px;">
              <summary>Podrobnosti</summary>
              <pre style="background:#f9f9f9;border:1px solid #e1e1e1;padding:10px;">
<?php
  foreach(['missing','corrupt','unexpected'] as $type){
    foreach($issues[$type] as $file){
      echo esc_html("[$type] $file\n");
    }
  }
?>
              </pre>
            </details>
          <?php endif;?>
        <?php endif;?>
      </div>
    </div>
    <?php

    echo '</div>'; // .wrap
}
?>
