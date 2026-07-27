// Weekly analytics — delegates to daily-analytics with ?weekly=true
// This endpoint is called separately (e.g., every Monday at 09:00)
export { default } from './daily-analytics.js';
