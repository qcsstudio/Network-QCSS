export const animationCreate = () => {
  if (typeof window !== "undefined" && window.WOW) {
    new window.WOW({ live: false }).init();
  }
};
