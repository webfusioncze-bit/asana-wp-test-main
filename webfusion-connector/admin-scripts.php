<?php
defined('ABSPATH') or die('Access denied');

function webfusion_admin_scripts() {
    ?>
    <script type="text/javascript">
        jQuery(document).ready(function($) {
            $('a[href*="plugin=webfusion-connector"]').on('click', function(e) {
                e.preventDefault();
                var message = "Varování: Deaktivací tohoto pluginu přestanete získávat důležité informace o stavu webu. Pro deaktivaci pluginu kontaktujte support Webfusion s.r.o.\n\nZadejte heslo pro deaktivaci:";
                var password = prompt(message);
                if (password !== null) {
                    $.post(ajaxurl, {
                        action: 'verify_deactivation_password',
                        deactivation_password: password
                    }, function(response) {
                        if (response.success) {
                            // Po úspěšném ověření hesla spusťte deaktivaci
                            $.post(ajaxurl, {
                                action: 'deactivate_webfusion_plugin'
                            }, function(deactivationResponse) {
                                if (deactivationResponse.success) {
                                    alert('Plugin byl úspěšně deaktivován.');
                                    window.location.reload();  // Obnovit stránku pro zobrazení změn
                                } else {
                                    alert('Došlo k chybě při deaktivaci pluginu: ' + deactivationResponse.data.message);
                                }
                            });
                        } else {
                            alert("Nesprávné heslo, deaktivace pluginu byla zamítnuta.");
                        }
                    });
                }
            });
        });
    </script>
    <?php
}
add_action('admin_footer', 'webfusion_admin_scripts');
