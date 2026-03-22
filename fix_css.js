const fs = require('fs');
const path = 'c:/Users/Lucas Pelatti/Documents/GitHub/autovehiculo-market/public/styles.css';
let content = fs.readFileSync(path, 'utf8');

// If the content is UTF-16 with null bytes, it might look like " . s e a r c h..."
// We want to remove the null bytes or double spaces
if (content.includes('\u0000')) {
    content = content.replace(/\u0000/g, '');
}

// Also handle the spaces if they are actual space characters
// We target the block after line 4326 (approx)
const lines = content.split('\n');
const fixedLines = lines.map(line => {
    if (line.includes(' s e a r c h ')) {
        return line.replace(/ /g, '');
    }
    // Only fix lines that look like " . s o m e t h i n g "
    if (line.trim().match(/^([A-Za-z0-9#\.\{\} ]{2,})$/) && line.includes(' ')) {
         // This is risky, let's be more specific
         if (line.includes(' d i s p l a y ') || line.includes(' f l e x ')) {
             return line.replace(/ /g, '');
         }
    }
    return line;
});

// Better yet: just truncate everything after line 4326 and append the correct CSS.
const mark = '.preview-cover.active {';
const index = content.indexOf(mark);
if (index !== -1) {
    const base = content.substring(0, index + mark.length + 1) + '\n}\n\n';
    const extra = `
/* SEARCH SECTION IMPROVED */
.search-section {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 2.25rem;
  width: 100%;
}

.search-bar {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-bar i, .search-bar svg {
  position: absolute;
  left: 1.25rem;
  width: 18px;
  height: 18px;
  color: var(--text-3);
  pointer-events: none;
  z-index: 10;
}

.search-bar input {
  width: 100%;
  height: 54px;
  padding: 0 1rem 0 3.25rem !important;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  color: #fff;
  font-size: 0.95rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.search-bar input:focus {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(245, 158, 11, 0.5);
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.1), 0 8px 30px rgba(0, 0, 0, 0.3);
  outline: none;
}

@media (max-width: 900px) {
  .navbar {
    padding: 0 1.5rem;
    height: 64px;
  }
}

@media (max-width: 600px) {
  .search-section {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .navbar {
    padding: 0 1rem;
    height: 60px;
  }
  
  .nav-brand {
    font-size: 1.25rem;
  }
  
  .dolar-widget {
    display: none !important;
  }
}
`;
    fs.writeFileSync(path, base + extra, 'utf8');
    console.log('Fixed!');
} else {
    console.log('Mark not found');
}
