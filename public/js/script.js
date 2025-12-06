const sliderTabs = document.querySelectorAll(".slider-tab");
const sliderIndicator = document.querySelector(".slider-indicartor");

const updatePagination = (tab, index) => {
    sliderIndicator.style.transform = `translateX(${tab.offsetLeft - 20}px)`;
    sliderIndicator.style.width = `${tab.getBoundingClientRect().width}px`;
}
const swiper = new Swiper(".slider-container", {
    effect : "fade",
    speed: 1300,
    autoplay: {delay: 4000}
});

sliderTabs.forEach((tab, index) => {  
    tab.addEventListener("click", () => {
        swiper.slideTo(index);
        updatePagination(tab, index);
    })
});

const newsSwiper = new Swiper('.news-swiper', {
  slidesPerView: 'auto',
  spaceBetween: 16,
  loop: true,
  navigation: {
    nextEl: '.news-slider-arrow.right',
    prevEl: '.news-slider-arrow.left',
  },
  autoplay: {delay: 2000}
});

// Swiper init
const profileSwiper = new Swiper('.profile-swiper', {
  slidesPerView: 'auto',
  centeredSlides: true,
  spaceBetween: 30,
    loop: true,
  effect: 'slide', // hoặc bỏ effect để mặc định, KHÔNG dùng 'coverflow'
  navigation: {
    nextEl: '.profile-slider-arrow.right',
    prevEl: '.profile-slider-arrow.left',
  }
});

const kn2Swiper = new Swiper('.kn2-swiper', {
  slidesPerView: 'auto',
  spaceBetween: 16,
  loop: true,
  navigation: {
    nextEl: '.news-slider-arrow.right',
    prevEl: '.news-slider-arrow.left',
  },
  autoplay: {delay: 2000}
});





// Add this to your /js/script.js file

document.addEventListener('DOMContentLoaded', function () {
  // ... (keep your existing script.js code)

  // Initialize the Teacher Profile Swiper
  const profileSwiper = new Swiper('.profile-swiper', {
    loop: true,
    slidesPerView: 4, // Show 4 profiles at a time
    spaceBetween: 30, // Space between profile cards
    
    // Connect the navigation arrows
    navigation: {
      nextEl: '#teacher-slider-next',
      prevEl: '#teacher-slider-prev',
    },

    // Responsive settings
    breakpoints: {
      // when window width is >= 320px
      320: {
        slidesPerView: 1,
        spaceBetween: 10
      },
      // when window width is >= 640px
      640: {
        slidesPerView: 2,
        spaceBetween: 20
      },
      // when window width is >= 1024px
      1024: {
        slidesPerView: 4,
        spaceBetween: 30
      }
    }
  });
});
