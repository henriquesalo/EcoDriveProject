document.addEventListener('DOMContentLoaded', function() {
    const registerLink = document.getElementById('registerLink');

    registerLink.addEventListener('click', function(e) {
        e.preventDefault();
        const page = this.getAttribute('href');
        fetch(page)
            .then(response => response.text())
            .then(html => {
                document.querySelector('.login-container').innerHTML = html;
            })
            .catch(error => console.error('Erro ao carregar a página de registro:', error));
    });
});