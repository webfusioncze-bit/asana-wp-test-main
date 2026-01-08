window.addEventListener('load', function() {
    // Získání informace o zařízení
    function getDeviceType() {
        const ua = navigator.userAgent;
        if (/tablet|ipad|playbook|silk/i.test(ua)) {
            return "tablet";
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|Kindle|Silk-Accelerated|Phone|Opera Mini|Opera Mobi/i.test(ua)) {
            return "mobile";
        }
        return "desktop";
    }

    // Získání informace o zemi pomocí externí služby
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            const country = data.country_code || 'unknown';
            const device = getDeviceType();

            // Vaše stávající měření načítací doby
            setTimeout(function() {
                var performanceData = window.performance.timing;
                var pageLoadTime = performanceData.loadEventEnd - performanceData.navigationStart;

                if (pageLoadTime > 0) {
                    fetch('/wp-admin/admin-ajax.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: `action=save_performance_data&load_time=${pageLoadTime}&device=${device}&country=${country}`
                    });
                } else {
                    console.log('Invalid load time calculated:', pageLoadTime);
                }
            }, 1000); // Odložení o 1000 ms (1 sekunda)
        })
        .catch(error => {
            console.error('Error fetching location data:', error);
            // Pokud se nepodaří získat zemi, pokračujeme bez ní
            const device = getDeviceType();
            // Vaše stávající měření načítací doby
            setTimeout(function() {
                var performanceData = window.performance.timing;
                var pageLoadTime = performanceData.loadEventEnd - performanceData.navigationStart;

                if (pageLoadTime > 0) {
                    fetch('/wp-admin/admin-ajax.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: `action=save_performance_data&load_time=${pageLoadTime}&device=${device}&country=unknown`
                    });
                } else {
                    console.log('Invalid load time calculated:', pageLoadTime);
                }
            }, 1000); // Odložení o 1000 ms (1 sekunda)
        });

    // Sledování First Contentful Paint a Largest Contentful Paint
    if ('PerformanceObserver' in window) {
        let observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.entryType === 'paint') {
                    console.log(`Time of ${entry.name}: ${entry.startTime}`);
                    // Případně odešlete tyto údaje na server
                    fetch('/wp-admin/admin-ajax.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: `action=save_performance_data&${entry.name}=${entry.startTime}`
                    });
                }
            }
        });
        observer.observe({entryTypes: ['paint']});
    }
});
