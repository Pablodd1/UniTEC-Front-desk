// UniTEC AI Chatbot Embed Script
// Add this to your website to embed the chatbot widget
// Websites: https://www.building-innovation.us/ and https://www.unitecusadesign.com/

(function() {
  // Configuration
  const config = {
    // Change this to match your brand
    // 'unitec' for unitecusadesign.com
    // 'building' for building-innovation.us
    brandId: window.location.hostname.includes('building-innovation') ? 'building' : 'unitec',
    
    // Widget dimensions - BIGGER for better visibility
    width: '480px',        // Increased from 400px
    height: '700px',       // Increased from 600px
    
    // Position
    position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left
    
    // Colors
    buttonColor: '#0ea5e9',
    buttonText: '💬 Chat',
    
    // Language
    language: 'es', // Spanish default
    
    // Z-index (ensure it's above other elements)
    zIndex: 9999,
  };

  // Create container
  const container = document.createElement('div');
  container.id = 'unitec-chatbot-container';
  container.style.cssText = `
    position: fixed;
    ${config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
    ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
    width: ${config.width};
    height: ${config.height};
    z-index: ${config.zIndex};
    display: none;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    transition: all 0.3s ease;
  `;

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = `https://unitec-front-desk.vercel.app/?embed=true&brandId=${config.brandId}&lang=${config.language}`;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 20px;
  `;
  iframe.allow = 'microphone; autoplay';
  iframe.title = 'AI Chatbot';
  
  container.appendChild(iframe);
  document.body.appendChild(container);

  // Create toggle button
  const button = document.createElement('button');
  button.id = 'unitec-chatbot-toggle';
  button.innerHTML = config.buttonText;
  button.style.cssText = `
    position: fixed;
    ${config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
    ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
    z-index: ${config.zIndex + 1};
    padding: 16px 24px;
    background: linear-gradient(135deg, ${config.buttonColor} 0%, #0284c7 100%);
    color: white;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(14, 165, 233, 0.4);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.05)';
    button.style.boxShadow = '0 6px 30px rgba(14, 165, 233, 0.6)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 20px rgba(14, 165, 233, 0.4)';
  });
  
  document.body.appendChild(button);

  // Toggle functionality
  let isOpen = false;
  button.addEventListener('click', () => {
    isOpen = !isOpen;
    if (isOpen) {
      container.style.display = 'block';
      button.style.display = 'none';
    } else {
      container.style.display = 'none';
      button.style.display = 'flex';
    }
  });

  // Listen for close messages from iframe
  window.addEventListener('message', (event) => {
    if (event.data === 'close-chatbot') {
      isOpen = false;
      container.style.display = 'none';
      button.style.display = 'flex';
    }
  });

  // Mobile responsive
  if (window.innerWidth < 768) {
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.bottom = '0';
    container.style.right = '0';
    container.style.left = '0';
    container.style.top = '0';
    container.style.borderRadius = '0';
    iframe.style.borderRadius = '0';
  }

  console.log('✅ UniTEC AI Chatbot loaded - Brand:', config.brandId);
})();
