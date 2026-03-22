const fs = require('fs');
const path = 'c:/Users/Lucas Pelatti/Documents/GitHub/autovehiculo-market/public/styles.css';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove all null bytes or spaced-out chars
if (content.includes('\u0000')) {
    content = content.replace(/\u0000/g, '');
}

// 2. Fix the spaced out characters specifically
// This is a more robust regex for the spaced-out blocks
content = content.replace(/([A-Za-z0-9#\.\{\}\(\):;!%@\*\/_-]) /g, '$1');
// Double check common keywords
content = content.replace(/d i s p l a y/g, 'display');
content = content.replace(/f l e x/g, 'flex');
content = content.replace(/m a r g i n/g, 'margin');
content = content.replace(/p a d d i n g/g, 'padding');
content = content.replace(/! i m p o r t a n t/g, '!important');

// 3. Append the clean version of the fixes
const fixes = `

/* FINAL MOBILE OPTIMIZATIONS */
@media (max-width: 480px) {
  .vehicle-card {
    flex-direction: column !important;
    min-height: auto !important;
  }
  
  .vehicle-image-container {
    width: 100% !important;
    aspect-ratio: 16/10 !important;
    height: auto !important;
  }
  
  .vehicle-info {
    padding: 1.25rem !important;
  }

  .vehicle-title {
    white-space: normal !important;
    font-size: 1.1rem !important;
  }
  
  .navbar {
    padding: 0 1rem !important;
  }

  .nav-brand {
    font-size: 1.1rem !important;
  }
}
`;

fs.writeFileSync(path, content + fixes, 'utf8');
console.log('Fixed and Appended!');
