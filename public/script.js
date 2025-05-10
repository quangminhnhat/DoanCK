const sliderTabs = document.querySelectorAll(".slider-tab");
// Fix typo in selector name
const sliderIndicator = document.querySelector(".slider-indicator");

const updatePagination = (tab, index) => {
  sliderIndicator.style.transform = `translateX(${tab.offsetLeft - 20}px)`;
  sliderIndicator.style.width = `${tab.getBoundingClientRect().width}px`;
};
const swiper = new Swiper(".slider-container", {
  effect: "fade",
  speed: 1300,
  autoplay: { delay: 4000 },
});

sliderTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    swiper.slideTo(index);
    updatePagination(tab, index);
  });
});

window.addEventListener('load', () => {
    updatePagination(sliderTabs[0], 0);
});
