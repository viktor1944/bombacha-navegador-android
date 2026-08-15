// Bombacha: Auto-skip vk.com/away.php warning page
(function() {
    if (!window.location.href.includes('/away.php')) return;

    const params = new URLSearchParams(window.location.search);
    const dest = params.get('to');
    if (!dest) return;

    try {
        const realUrl = decodeURIComponent(dest);
        console.log('Bombacha: pulando aviso away.php, redirecionando para:', realUrl);
        window.location.replace(realUrl);
    } catch(e) {
        console.log('Bombacha: erro ao decodificar URL away:', e);
    }
})();
