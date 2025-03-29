document.addEventListener('DOMContentLoaded', function() {
  fetch('../../html/carousel.html')
    .then(response => response.text())
    .then(data => {
      document.getElementById('carousel-section').innerHTML = data;
      initializeCarousel();
    });
});

let currentIndex = 0;
let autoSlideInterval;

function initializeCarousel() {
  const slides = document.querySelectorAll('.carousel-wrapper img');
  const totalSlides = slides.length;

  function showSlide(index) {
    if (index >= totalSlides) {
      currentIndex = 0;
    } else if (index < 0) {
      currentIndex = totalSlides - 1;
    } else {
      currentIndex = index;
    }
    const offset = -currentIndex * 100;
    document.querySelector('.carousel-wrapper').style.transform = `translateX(${offset}vw)`;
  }

  function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(() => moveSlide(1), 4000);
  }

  document.querySelector('.prev').addEventListener('click', () => {
    moveSlide(-1);
    resetAutoSlide();
  });

  document.querySelector('.next').addEventListener('click', () => {
    moveSlide(1);
    resetAutoSlide();
  });

  resetAutoSlide();
}

function moveSlide(step) {
  currentIndex += step;
  const slides = document.querySelectorAll('.carousel-wrapper img');
  if (currentIndex >= slides.length) {
    currentIndex = 0;
  } else if (currentIndex < 0) {
    currentIndex = slides.length - 1;
  }
  const offset = -currentIndex * 100;
  document.querySelector('.carousel-wrapper').style.transform = `translateX(${offset}vw)`;
}
