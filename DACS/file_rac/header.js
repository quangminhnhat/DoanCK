document.addEventListener('DOMContentLoaded', function () {
  fetch('../../html/header.html')
    .then(response => response.text())
    .then(data => {
      document.getElementById('header-section').innerHTML = data;

      // Xử lý hover để mở menu
      const dropdowns = document.querySelectorAll('.dropdown');
      dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');

        // Hover để mở dropdown
        dropdown.addEventListener('mouseenter', () => {
          menu.style.display = 'block';
          setTimeout(() => {
            menu.style.opacity = '1';
            menu.style.visibility = 'visible';
            menu.style.transform = 'translateY(0)';
          }, 10);
        });

        // Rời chuột để đóng dropdown
        dropdown.addEventListener('mouseleave', () => {
          menu.style.opacity = '0';
          menu.style.visibility = 'hidden';
          menu.style.transform = 'translateY(10px)';
          setTimeout(() => {
            menu.style.display = 'none';
          }, 300); 
        });
      });

      // Đóng menu khi click ra ngoài
      window.addEventListener('click', function (e) {
        if (!e.target.closest('.dropdown')) {
          document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.style.opacity = '0';
            menu.style.visibility = 'hidden';
            menu.style.transform = 'translateY(10px)';
            setTimeout(() => {
              menu.style.display = 'none';
            }, 300);
          });
        }
      });
    })
    .catch(error => console.error('Lỗi khi tải header:', error));
});
