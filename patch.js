const fs = require('fs');
const path = require('path');
const servicesPath = path.join(__dirname, 'components', 'ServicesTab.tsx');
const detailPath = path.join(__dirname, 'components', 'ProductDetail.tsx');

let servicesContent = fs.readFileSync(servicesPath, 'utf8');
const servicesTarget = {false ? (
                      <img src={''} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (;
const servicesReplacement = {product.image_url ? (
                      <img src={product.image_url.includes('drive.google.com/file/d/') ? \https://drive.google.com/uc?export=view&id=\\ : product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (;
servicesContent = servicesContent.split(servicesTarget).join(servicesReplacement);
fs.writeFileSync(servicesPath, servicesContent);

let detailContent = fs.readFileSync(detailPath, 'utf8');
const detailTarget = {false ? (
            <img 
              src={''} 
              alt={product.name}
              className="w-full h-full object-contain mix-blend-multiply"
            />
          ) : (;
const detailReplacement = {product.image_url ? (
            <img 
              src={product.image_url.includes('drive.google.com/file/d/') ? \https://drive.google.com/uc?export=view&id=\\ : product.image_url} 
              alt={product.name}
              className="w-full h-full object-contain mix-blend-multiply"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (;
detailContent = detailContent.split(detailTarget).join(detailReplacement);
fs.writeFileSync(detailPath, detailContent);

console.log('patched');
