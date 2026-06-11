// UniTEC USA Design Chatbot Embed Script
// Website: https://www.unitecusadesign.com/

(function() {
  const config = {
    brandId: 'unitec',
    width: '480px',
    height: '700px',
    position: 'bottom-right',
    buttonColor: '#0ea5e9',
    buttonText: 'ðŸ’¬ Chat',
    language: 'es',
    zIndex: 9999,
  };

  const container = document.createElement('div');
  container.id = 'unitec-chatbot-widget';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
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

  const iframe = document.createElement('iframe');
  iframe.src = `https://chatbuildinginnovation.us/?embed=true&brandId=${config.brandId}&lang=${config.language}`;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 20px;
  `;
  iframe.allow = 'microphone; autoplay';
  iframe.title = 'UniTEC USA Design AI Chatbot';
  
  container.appendChild(iframe);
  document.body.appendChild(container);

  const button = document.createElement('button');
  button.id = 'unitec-chatbot-button';
  button.innerHTML = config.buttonText;
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
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
  
  document.body.appendChild(button);

  let isOpen = false;
  button.addEventListener('click', () => {
    isOpen = !isOpen;
    container.style.display = isOpen ? 'block' : 'none';
    button.style.display = isOpen ? 'none' : 'flex';
  });

  window.addEventListener('message', (event) => {
    if (event.data === 'close-chatbot') {
      isOpen = false;
      container.style.display = 'none';
      button.style.display = 'flex';
    }
  });

  if (window.innerWidth < 768) {
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.bottom = '0';
    container.style.right = '0';
    container.style.left = '0';
    container.style.top = '0';
    container.style.borderRadius = '0';
  }

  console.log('âœ… UniTEC USA Design Chatbot loaded');
})();

