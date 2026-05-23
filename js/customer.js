import { auth, db } from './firebase-config.js';
import { 
    collection, 
    onSnapshot, 
    query, 
    where,
    doc,
    getDoc,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { showToast } from './ui-utils.js';

// --- DOM Elements ---
const mainNavbar = document.getElementById('main-navbar');
const foodSearch = document.getElementById('food-search');
const btnVoiceSearch = document.getElementById('btn-voice-search');
const btnCartToggle = document.getElementById('btn-cart-toggle');
const btnCartToggleMob = document.getElementById('btn-cart-toggle-mob');

// Views
const heroBanner = document.getElementById('hero-banner');
const viewHome = document.getElementById('view-home');
const viewChicken = document.getElementById('view-chicken');
const viewMasalas = document.getElementById('view-masalas');
const viewAbout = document.getElementById('view-about');

// Grids
const featuredFoodGrid = document.getElementById('featured-food-grid');
const chickenGrid = document.getElementById('chicken-grid');
const masalaGrid = document.getElementById('masala-grid');
const chickenFilters = document.getElementById('chicken-filters');
const masalaFilters = document.getElementById('masala-filters');

// Chatbot DOM
const chatbotBtn = document.getElementById('chatbot-btn');
const chatbotPanel = document.getElementById('chatbot-panel');
const chatbotClose = document.getElementById('chatbot-close');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSend = document.getElementById('chatbot-send');
const chatbotBody = document.getElementById('chatbot-body');

// Voice DOM
const voiceModal = document.getElementById('voice-modal');
const btnVoiceCancel = document.getElementById('btn-voice-cancel');

// --- State Variables ---
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('food_cart_v2')) || [];
let activeCoupon = null;
let currentView = 'home';
let activeChickenFilter = 'All';
let activeMasalaFilter = 'All';
let shopSettings = { schedule: {} };
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// --- 1. SPA View Router ---
const viewsMap = {
    home: { sec: viewHome, showHero: true },
    chicken: { sec: viewChicken, showHero: false },
    masalas: { sec: viewMasalas, showHero: false },
    about: { sec: viewAbout, showHero: false }
};

function switchView(viewName) {
    if (!viewsMap[viewName]) return;
    
    currentView = viewName;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Toggle Section displays
    Object.keys(viewsMap).forEach(key => {
        const v = viewsMap[key];
        if (key === viewName) {
            v.sec.classList.remove('hidden');
        } else {
            v.sec.classList.add('hidden');
        }
    });

    // Toggle Hero display
    if (viewsMap[viewName].showHero) {
        heroBanner.classList.remove('hidden');
    } else {
        heroBanner.classList.add('hidden');
    }

    // Update active class on nav links
    document.querySelectorAll('.nav-link, .mob-nav-item').forEach(el => {
        if (el.getAttribute('data-view') === viewName) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    // Load elements specific to the view
    if (viewName === 'chicken' || viewName === 'masalas') {
        renderFilteredProducts();
    }
}

// Router Event Listeners
document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        const view = el.getAttribute('data-view');
        switchView(view);
        
        // Update URL hash without reload
        history.pushState(null, null, `#${view}`);
    });
});

// Sync router on page load hash
window.addEventListener('load', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && viewsMap[hash]) {
        switchView(hash);
    } else {
        switchView('home');
    }
});

// Navbar scroll background change
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        mainNavbar.classList.add('scrolled');
    } else {
        mainNavbar.classList.remove('scrolled');
    }
});

// --- 2. Spice Particles Canvas Animation ---
const canvas = document.getElementById('spice-particles');
const ctx = canvas.getContext('2d');

let particles = [];
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class SpiceParticle {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + Math.random() * 100;
        this.size = Math.random() * 3 + 1;
        this.speedY = Math.random() * 1.5 + 0.5;
        this.speedX = Math.sin(Math.random() * 2) * 0.5;
        this.alpha = Math.random() * 0.5 + 0.3;
        // Chillis, turmeric or coriander seed colors
        const colors = ['#ff4a22', '#f59e0b', '#d4af37', '#e21d48'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
        this.y -= this.speedY;
        this.x += this.speedX;
        if (this.y < -10) {
            this.reset();
        }
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }
}

// Populate particles
for (let i = 0; i < 35; i++) {
    particles.push(new SpiceParticle());
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Only draw particles if home hero banner is visible
    if (currentView === 'home') {
        particles.forEach(p => {
            p.update();
            p.draw();
        });
    }
    
    requestAnimationFrame(animateParticles);
}
animateParticles();

// --- 3. Hero Slideshow & Typing Title Loop ---
let currentSlide = 0;
const slides = document.querySelectorAll('.hero-slide');
function cycleSlides() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
}
setInterval(cycleSlides, 6000);

// Typing text cycle
const typingText = document.getElementById('typing-text');
const wordsList = ["Premium Marinated Chicken cuts", "Preservative-Free Spices", "Cleaned & Ready to Pan Fry", "Farm Fresh Ingredients"];
let wordIdx = 0;
let charIdx = 0;
let isDeleting = false;

function typeAnimation() {
    const currentWord = wordsList[wordIdx];
    if (isDeleting) {
        typingText.textContent = currentWord.substring(0, charIdx - 1);
        charIdx--;
    } else {
        typingText.textContent = currentWord.substring(0, charIdx + 1);
        charIdx++;
    }

    let speed = isDeleting ? 40 : 80;

    if (!isDeleting && charIdx === currentWord.length) {
        speed = 2500; // Wait at complete word
        isDeleting = true;
    } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        wordIdx = (wordIdx + 1) % wordsList.length;
        speed = 500;
    }

    setTimeout(typeAnimation, speed);
}
setTimeout(typeAnimation, 1000);

// --- 4. Intersection Observer: Scroll Fade-Ins & Stats ---
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animated');
            // Trigger stats counters if this is the stats section
            if (entry.target.classList.contains('stats-section')) {
                animateCounters();
            }
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.scroll-animate').forEach(el => {
    scrollObserver.observe(el);
});

function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach(counter => {
        if (counter.classList.contains('counted')) return;
        counter.classList.add('counted');
        
        const target = parseInt(counter.getAttribute('data-target'));
        const duration = 2000; // 2 seconds
        const startTime = performance.now();

        function updateCount(currentTime) {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const value = Math.floor(progress * target);
            
            counter.innerText = value.toLocaleString() + (target === 98 ? "%" : (target === 45 || target === 15 ? "" : "+"));

            if (progress < 1) {
                requestAnimationFrame(updateCount);
            }
        }
        requestAnimationFrame(updateCount);
    });
}

// --- 5. Firebase Product Fetching & Rendering ---
let selectedVariants = {}; // tracks selected variants per card, e.g. { productId: variantName }

// Shop status checks
async function checkShopStatus() {
    const snap = await getDoc(doc(db, "settings", "shop"));
    if (snap.exists()) {
        shopSettings = snap.data();
    }
}
checkShopStatus();

function isShopOpen() {
    if (!shopSettings || !shopSettings.schedule) return true;
    const now = new Date();
    const dayName = DAYS_OF_WEEK[now.getDay()];
    const dayData = shopSettings.schedule[dayName];
    if (!dayData || dayData.isClosed) return false;
    if (!dayData.open || !dayData.close) return false;

    try {
        const [hOpen, mOpen] = dayData.open.split(':').map(Number);
        const [hClose, mClose] = dayData.close.split(':').map(Number);
        
        if (isNaN(hOpen) || isNaN(mOpen) || isNaN(hClose) || isNaN(mClose)) return false;

        const openTime = new Date(now);
        openTime.setHours(hOpen, mOpen, 0);
        const closeTime = new Date(now);
        closeTime.setHours(hClose, mClose, 0);

        if (closeTime < openTime) {
            if (now < closeTime) return true;
            return now >= openTime;
        }
        return now >= openTime && now <= closeTime;
    } catch (err) {
        console.error("Error in isShopOpen:", err);
        return false;
    }
}

// Real-time listener
const q = query(collection(db, "products"));
onSnapshot(q, (snapshot) => {
    allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderHomeFeatured();
    renderFilteredProducts();
    updateCartCount();
});

// Render chef choices (featured) on home view
function renderHomeFeatured() {
    if (!featuredFoodGrid) return;
    // Featured are available items containing offer badges, or first 3
    let featured = allProducts.filter(p => p.isAvailable !== false && p.offer).slice(0, 3);
    if (featured.length === 0) featured = allProducts.slice(0, 3);
    
    renderProductCards(featured, featuredFoodGrid);
}

// Filter and render for shop categories
function renderFilteredProducts() {
    const isChicken = currentView === 'chicken';
    const grid = isChicken ? chickenGrid : masalaGrid;
    const filterContainer = isChicken ? chickenFilters : masalaFilters;
    const activeFilter = isChicken ? activeChickenFilter : activeMasalaFilter;
    
    if (!grid) return;
    
    // Distinguish products:
    // We treat as Masala if category matches 'masala', 'spices', 'spice mix' (case-insensitive), or if unit is 'PACKET'.
    // Otherwise it is Chicken.
    const products = allProducts.filter(p => {
        const cat = (p.category || '').toLowerCase();
        const isMasalaCat = cat.includes('masala') || cat.includes('spice') || cat.includes('powder');
        return isChicken ? !isMasalaCat : isMasalaCat;
    });

    // Render Filters
    if (filterContainer) {
        const subCats = ['All', ...new Set(products.map(p => p.category).filter(c => c))];
        filterContainer.innerHTML = '';
        subCats.forEach(cat => {
            const pill = document.createElement('button');
            pill.className = `cat-pill ${cat === activeFilter ? 'active' : ''}`;
            pill.innerText = cat;
            pill.addEventListener('click', () => {
                if (isChicken) {
                    activeChickenFilter = cat;
                } else {
                    activeMasalaFilter = cat;
                }
                renderFilteredProducts();
            });
            filterContainer.appendChild(pill);
        });
    }

    // Apply active filter
    let filtered = products;
    if (activeFilter !== 'All') {
        filtered = products.filter(p => p.category === activeFilter);
    }

    // Apply Search term if search bar has content
    const term = foodSearch.value.trim().toLowerCase();
    if (term) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
    }

    renderProductCards(filtered, grid);
}

// Shared renderer
function renderProductCards(products, targetGrid) {
    targetGrid.innerHTML = '';
    
    const isOpen = isShopOpen();
    if (!isOpen) {
        const closedMsg = document.createElement('div');
        closedMsg.style = "grid-column: 1/-1; background: rgba(239, 68, 68, 0.15); border: 1px solid var(--primary); padding: 18px; border-radius: var(--radius-md); text-align: center; color: var(--primary); font-weight: 700;";
        closedMsg.innerText = "🌙 Shop is currently closed. You can pre-add items to your cart, but order placement is offline.";
        targetGrid.appendChild(closedMsg);
    }

    if (products.length === 0) {
        targetGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">No products found matching the criteria.</div>';
        return;
    }

    products.forEach(product => {
        const isOutOfStock = product.isAvailable === false || (product.stock !== undefined && product.stock <= 0);
        
        // Handle variant default selection
        const hasVariants = product.variants && product.variants.length > 0;
        let selectedVariantName = selectedVariants[product.id];
        
        if (hasVariants && !selectedVariantName) {
            // default to first variant
            selectedVariantName = product.variants[0].name;
            selectedVariants[product.id] = selectedVariantName;
        }

        // Get price based on selection
        let displayPrice = product.price;
        if (hasVariants) {
            const vObj = product.variants.find(v => v.name === selectedVariantName);
            if (vObj) displayPrice = vObj.price;
        }

        // Get cart quantity for this specific variant
        const cartKey = hasVariants ? `${product.id}_${selectedVariantName}` : product.id;
        const cartItem = cart.find(item => item.cartKey === cartKey);
        const qty = cartItem ? cartItem.quantity : 0;

        // Spice levels indicators
        let spiceMarkup = '';
        if (product.spiceLevel) {
            let chilisCount = 1;
            const sl = product.spiceLevel.toLowerCase();
            if (sl.includes('extra') || sl.includes('high')) chilisCount = 4;
            else if (sl.includes('spicy') || sl.includes('hot')) chilisCount = 3;
            else if (sl.includes('medium')) chilisCount = 2;
            
            spiceMarkup = `<div class="spice-rating" title="Spice Level: ${product.spiceLevel}">` + '🌶️'.repeat(chilisCount) + '</div>';
        }

        // Variant selector dropdown
        let variantUI = '';
        if (hasVariants) {
            const options = product.variants.map(v => `<option value="${v.name}" ${v.name === selectedVariantName ? 'selected' : ''}>${v.name} - ₹${v.price}</option>`).join('');
            variantUI = `
                <div class="variant-selector">
                    <select class="variant-select" onchange="changeProductVariant('${product.id}', this.value)">
                        ${options}
                    </select>
                </div>
            `;
        } else {
            variantUI = `<div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">Unit: ${product.unit || 'Standard'}</div>`;
        }

        // Card button actions
        let controlUI = '';
        if (isOutOfStock) {
            controlUI = `<button class="swiggy-add-btn" disabled style="background: rgba(255,255,255,0.05); color:#666; border-color:transparent; cursor:not-allowed; width: 100%;">Sold Out</button>`;
        } else if (qty > 0) {
            controlUI = `
                <div class="cart-qty-ctrl">
                    <div class="qty-control-btn" onclick="updateItemQty('${product.id}', '${selectedVariantName || ''}', -1)">−</div>
                    <div style="font-weight: 800; min-width: 16px; text-align: center;">${qty}</div>
                    <div class="qty-control-btn" onclick="updateItemQty('${product.id}', '${selectedVariantName || ''}', 1)">+</div>
                </div>`;
        } else {
            controlUI = `<button class="swiggy-add-btn" onclick="updateItemQty('${product.id}', '${selectedVariantName || ''}', 1)">ADD</button>`;
        }

        const card = document.createElement('div');
        card.className = 'food-card scroll-animate animated';
        card.innerHTML = `
            <div class="food-img-wrapper">
                <img src="${product.imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=600&auto=format&fit=crop'}" alt="${product.name}" loading="lazy">
                ${product.offer ? `<div class="food-overlay"><div class="food-offer">${product.offer}</div></div>` : ''}
                ${product.cookingTime ? `<div class="cooking-badge">🕒 ${product.cookingTime}</div>` : ''}
            </div>
            <div class="food-info">
                <div class="food-title-row">
                    <div class="food-title">${product.name}</div>
                    ${spiceMarkup}
                </div>
                <div class="food-meta">
                    <div class="category-tag">${product.category}</div>
                    <div class="rating-badge">⭐ 4.5</div>
                    ${product.stock !== undefined && product.stock <= 3 && product.stock > 0 ? `<div style="font-size:0.75rem; color:var(--primary); font-weight:700; background:rgba(255,74,34,0.1); padding:2px 6px; border-radius:4px;">Only ${product.stock} Left!</div>` : ''}
                </div>
                ${variantUI}
                <div class="food-bottom">
                    <div class="food-price">₹<span>${displayPrice}</span></div>
                    <div id="control-${product.id}-${selectedVariantName || 'none'}">
                        ${controlUI}
                    </div>
                </div>
            </div>
        `;
        targetGrid.appendChild(card);
    });
}

// Handle variant dropdown selection change
window.changeProductVariant = (productId, newVariantName) => {
    selectedVariants[productId] = newVariantName;
    renderHomeFeatured();
    renderFilteredProducts();
};

// Search trigger
foodSearch.addEventListener('input', () => {
    if (currentView === 'home') {
        // If searching on home page, auto switch to Chicken view to show list
        switchView('chicken');
    }
    renderFilteredProducts();
});

// See all featured redirect
document.getElementById('btn-see-all-featured')?.addEventListener('click', () => {
    switchView('chicken');
});

// CTAs
document.getElementById('hero-cta-chicken')?.addEventListener('click', () => {
    switchView('chicken');
});
document.getElementById('hero-cta-masala')?.addEventListener('click', () => {
    switchView('masalas');
});

// --- 6. Shopping Cart Management ---
// Update item quantities
window.updateItemQty = (productId, variantName, change) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const hasVariants = product.variants && product.variants.length > 0;
    const cartKey = hasVariants ? `${productId}_${variantName}` : productId;
    
    // Find price
    let finalPrice = product.price;
    if (hasVariants) {
        const vObj = product.variants.find(v => v.name === variantName);
        if (vObj) finalPrice = vObj.price;
    }

    const cartIdx = cart.findIndex(item => item.cartKey === cartKey);

    if (cartIdx > -1) {
        cart[cartIdx].quantity += change;
        if (cart[cartIdx].quantity <= 0) {
            cart.splice(cartIdx, 1);
            showToast(`${product.name} ${variantName ? `(${variantName})` : ''} removed from cart`);
        }
    } else if (change > 0) {
        cart.push({
            id: product.id,
            cartKey: cartKey,
            name: product.name,
            variantName: variantName || '',
            price: finalPrice,
            quantity: 1,
            imageUrl: product.imageUrl,
            spiceLevel: product.spiceLevel || ''
        });
        showToast(`${product.name} added to cart!`, 'success');
        
        // Trigger cart bounce animation
        if (btnCartToggle) {
            btnCartToggle.style.transform = 'scale(1.2)';
            setTimeout(() => btnCartToggle.style.transform = 'none', 200);
        }
    }

    localStorage.setItem('food_cart_v2', JSON.stringify(cart));
    updateCartCount();
    renderHomeFeatured();
    renderFilteredProducts();
};

function updateCartCount() {
    const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const cartCountEl = document.getElementById('cart-count');
    const cartCountMobEl = document.getElementById('cart-count-mob');
    if (cartCountEl) cartCountEl.textContent = totalCount;
    if (cartCountMobEl) cartCountMobEl.textContent = totalCount;
}

// Redirect or open auth modal on cart click
const handleCartClick = (e) => {
    e.preventDefault();
    if (auth.currentUser) {
        window.location.href = 'customer/cart.html';
    } else {
        showToast("Please login to view your cart.", "info");
        document.getElementById('auth-modal')?.classList.add('active');
    }
};

btnCartToggle?.addEventListener('click', handleCartClick);
btnCartToggleMob?.addEventListener('click', handleCartClick);

// Auth callbacks
window.onAuthSuccess = (userData) => {
    // Left empty since drawer UI is removed
};

window.onAuthLogout = () => {
    // Clear cart locally to secure order leak across users
    cart = [];
    localStorage.removeItem('food_cart_v2');
    updateCartCount();
    renderHomeFeatured();
    renderFilteredProducts();
};


// --- 9. Voice Search Simulated Logic ---
if (btnVoiceSearch) {
    btnVoiceSearch.addEventListener('click', () => {
        voiceModal.classList.add('active');
        
        // Simulate listening for 2.5 seconds
        setTimeout(() => {
            voiceModal.classList.remove('active');
            
            // Randomly simulate search keywords
            const phrases = ["Biryani cut", "Chicken Fry", "Kabab Masala", "Kabab cut", "Chicken Boneless"];
            const match = phrases[Math.floor(Math.random() * phrases.length)];
            foodSearch.value = match;
            
            showToast(`Voice Search Matched: "${match}"`, "success");
            
            // Auto switch to chicken and trigger rendering
            switchView('chicken');
            renderFilteredProducts();
        }, 2500);
    });

    btnVoiceCancel.addEventListener('click', () => {
        voiceModal.classList.remove('active');
    });
}

// --- 10. AI Chatbot Collapsible & Mock Responses ---
if (chatbotBtn && chatbotPanel && chatbotClose) {
    chatbotBtn.addEventListener('click', () => {
        chatbotPanel.classList.toggle('active');
    });
    chatbotClose.addEventListener('click', () => {
        chatbotPanel.classList.remove('active');
    });
}

window.sendQuickChat = (question) => {
    chatbotInput.value = question;
    triggerChatSend();
};

if (chatbotSend) {
    chatbotSend.addEventListener('click', triggerChatSend);
}

chatbotInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') triggerChatSend();
});

function triggerChatSend() {
    const text = chatbotInput.value.trim();
    if (!text) return;

    // Append user message
    appendChatMessage(text, 'user');
    chatbotInput.value = '';

    // Simulate bot thinking
    setTimeout(() => {
        const reply = getBotResponse(text);
        appendChatMessage(reply, 'bot');
    }, 800);
}

function appendChatMessage(msg, sender) {
    const div = document.createElement('div');
    div.className = `chat-msg ${sender}`;
    div.innerHTML = msg;
    chatbotBody.appendChild(div);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
}

function getBotResponse(question) {
    const qLower = question.toLowerCase();
    
    if (qLower.includes('hour') || qLower.includes('time') || qLower.includes('open')) {
        return "⏰ We are open from <b>9:00 AM to 10:00 PM</b> every day! If we take a holiday, you'll see a closed banner on the storefront.";
    }
    if (qLower.includes('pack') || qLower.includes('hygiene') || qLower.includes('fresh')) {
        return "📦 All meats are cut in a vacuum-sealed temperature-controlled facility and packed in food-grade bags with cold gel ice pads to ensure they arrive fresh at your door.";
    }
    if (qLower.includes('discount') || qLower.includes('coupon') || qLower.includes('offer')) {
        return "🏷️ Yes! You can use coupon code <b>SAMAYAL20</b> to get <b>Flat 20% Off</b> on your first order of marinated cuts and spices.";
    }
    if (qLower.includes('delivery') || qLower.includes('ship') || qLower.includes('charge')) {
        return "🛵 Delivery is free for orders above ₹500! For orders below ₹500, a standard charge of ₹40 applies. We deliver in under 45 minutes.";
    }
    if (qLower.includes('marinate') || qLower.includes('how to cook')) {
        return "🍗 Cooking is simple: take our marinated cuts, add them directly to a heated pan with oil or grill them. No extra salt or spices needed. Cook for 15-20 mins!";
    }
    
    return "🤖 I appreciate your message! For direct support or bulk catering, please contact us on WhatsApp at <b>+91 87547 43213</b>.";
}


