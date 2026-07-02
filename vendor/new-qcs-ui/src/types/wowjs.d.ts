// declare module 'wowjs' {
//   const WOW: any;
//   export default WOW;
// }
declare global {
  interface Window {
    WOW: any;
  }
}

export {};
