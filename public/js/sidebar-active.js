document.addEventListener("DOMContentLoaded", function () {

    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll("#iq-sidebar-toggle li a");

    menuLinks.forEach(link => {
        const href = link.getAttribute("href");

        if (href === currentPath) {
            document
                .querySelectorAll("#iq-sidebar-toggle li")
                .forEach(li => li.classList.remove("active"));

            link.parentElement.classList.add("active");
        }
    });

});
