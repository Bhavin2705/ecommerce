/* ============================================================
   ShopVault — Cart Module (cart.js)
   Client-side cart with in-memory Map, checkout via API.
   NEVER uses innerHTML — all DOM via textContent / createElement.
   ============================================================ */

(function () {
    'use strict';

    // Module-scoped cart: Map<productId, { product, quantity }>
    var cart = new Map();

    var currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    });

    /**
     * Add a product to the cart or increment its quantity.
     * @param {object} product
     * @param {number} qty
     */
    function addToCart(product, qty) {
        if (!qty) qty = 1;

        var id = product.id;
        var stock = product.stock_quantity != null ? product.stock_quantity : 0;

        if (cart.has(id)) {
            var entry = cart.get(id);
            var newQty = entry.quantity + qty;
            if (newQty > stock) {
                window.API.showToast('Cannot exceed available stock (' + stock + ')', 'error');
                return;
            }
            entry.quantity = newQty;
        } else {
            if (qty > stock) {
                window.API.showToast('Cannot exceed available stock (' + stock + ')', 'error');
                return;
            }
            cart.set(id, { product: product, quantity: qty });
        }

        updateCartBadge();
        window.API.showToast(product.name + ' added to cart', 'success');
    }

    /**
     * Remove a product from the cart.
     * @param {string} productId
     */
    function removeFromCart(productId) {
        cart.delete(productId);
        updateCartBadge();
        renderCart();
        window.API.showToast('Item removed from cart', 'info');
    }

    /**
     * Update the quantity for a cart item.
     * @param {string} productId
     * @param {number} qty
     */
    function updateQuantity(productId, qty) {
        if (!cart.has(productId)) return;

        var entry = cart.get(productId);
        var stock = entry.product.stock_quantity != null ? entry.product.stock_quantity : 0;

        if (qty < 1) {
            removeFromCart(productId);
            return;
        }

        if (qty > stock) {
            window.API.showToast('Cannot exceed stock (' + stock + ')', 'error');
            entry.quantity = stock;
        } else {
            entry.quantity = qty;
        }

        updateCartBadge();
        renderCart();
    }

    /**
     * Get total number of items in cart.
     * @returns {number}
     */
    function getCartCount() {
        var count = 0;
        cart.forEach(function (entry) {
            count += entry.quantity;
        });
        return count;
    }

    /**
     * Get cart grand total.
     * @returns {number}
     */
    function getCartTotal() {
        var total = 0;
        cart.forEach(function (entry) {
            total += (entry.product.price || 0) * entry.quantity;
        });
        return total;
    }

    /**
     * Render the full cart view.
     */
    function renderCart() {
        var container = document.getElementById('cart-content');
        if (!container) return;

        container.replaceChildren();

        if (cart.size === 0) {
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            var emptyIcon = document.createElement('div');
            emptyIcon.className = 'empty-icon';
            emptyIcon.textContent = '🛒';
            var emptyText = document.createElement('p');
            emptyText.textContent = 'Your cart is empty. Browse our catalog to add products!';
            empty.appendChild(emptyIcon);
            empty.appendChild(emptyText);
            container.appendChild(empty);
            return;
        }

        // Cart items
        var itemsWrapper = document.createElement('div');
        itemsWrapper.className = 'cart-items';

        cart.forEach(function (entry, productId) {
            var item = document.createElement('div');
            item.className = 'cart-item';

            // Name
            var nameEl = document.createElement('div');
            nameEl.className = 'cart-item-name';
            nameEl.textContent = entry.product.name || 'Product';

            // Unit price
            var priceEl = document.createElement('div');
            priceEl.className = 'cart-item-price';
            priceEl.textContent = currencyFormatter.format(entry.product.price || 0);

            // Quantity input
            var qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.className = 'cart-item-qty';
            qtyInput.min = '1';
            qtyInput.max = String(entry.product.stock_quantity || 99);
            qtyInput.value = String(entry.quantity);
            (function (pid) {
                qtyInput.addEventListener('change', function () {
                    var newQty = parseInt(qtyInput.value, 10);
                    if (isNaN(newQty) || newQty < 1) newQty = 1;
                    updateQuantity(pid, newQty);
                });
            })(productId);

            // Line total
            var totalEl = document.createElement('div');
            totalEl.className = 'cart-item-total';
            totalEl.textContent = currencyFormatter.format(
                (entry.product.price || 0) * entry.quantity
            );

            // Remove button
            var removeBtn = document.createElement('button');
            removeBtn.className = 'cart-item-remove';
            removeBtn.textContent = '✕';
            removeBtn.title = 'Remove item';
            (function (pid) {
                removeBtn.addEventListener('click', function () {
                    removeFromCart(pid);
                });
            })(productId);

            item.appendChild(nameEl);
            item.appendChild(priceEl);
            item.appendChild(qtyInput);
            item.appendChild(totalEl);
            item.appendChild(removeBtn);
            itemsWrapper.appendChild(item);
        });

        container.appendChild(itemsWrapper);

        // Summary
        var summary = document.createElement('div');
        summary.className = 'cart-summary';

        var summaryLeft = document.createElement('div');
        var totalLabel = document.createElement('div');
        totalLabel.className = 'cart-summary-total';
        totalLabel.textContent = 'Grand Total';
        var totalAmount = document.createElement('div');
        totalAmount.className = 'cart-summary-amount';
        totalAmount.textContent = currencyFormatter.format(getCartTotal());
        summaryLeft.appendChild(totalLabel);
        summaryLeft.appendChild(totalAmount);

        var checkoutBtn = document.createElement('button');
        checkoutBtn.className = 'btn btn-primary';
        checkoutBtn.textContent = 'Proceed to Checkout';
        checkoutBtn.disabled = cart.size === 0;
        checkoutBtn.addEventListener('click', handleCheckout);

        summary.appendChild(summaryLeft);
        summary.appendChild(checkoutBtn);
        container.appendChild(summary);
    }

    /**
     * Handle checkout — POST order to API.
     */
    async function handleCheckout() {
        if (cart.size === 0) {
            window.API.showToast('Cart is empty', 'error');
            return;
        }

        // Check auth
        if (!window.API.getAccessToken()) {
            window.API.showToast('Please sign in to checkout', 'error');
            showView('auth');
            return;
        }

        var items = [];
        cart.forEach(function (entry) {
            items.push({
                product_id: entry.product.id,
                quantity: entry.quantity
            });
        });

        try {
            var order = await window.API.apiFetch('/orders/', {
                method: 'POST',
                body: JSON.stringify({ items: items })
            });

            // Clear cart
            cart.clear();
            updateCartBadge();

            var orderId = order.id || order.order_id || 'unknown';
            window.API.showToast(
                'Order placed! ID: ' + String(orderId).substring(0, 8) + '…',
                'success'
            );

            // Switch to orders view
            if (typeof showView === 'function') {
                showView('orders');
            }
        } catch (err) {
            window.API.showToast(err.message || 'Checkout failed', 'error');
        }
    }

    /**
     * Update the cart badge count in the navbar.
     */
    function updateCartBadge() {
        var badge = document.getElementById('cart-badge');
        if (badge) {
            var count = getCartCount();
            badge.textContent = String(count);
            if (count > 0) {
                badge.removeAttribute('data-count');
            } else {
                badge.setAttribute('data-count', '0');
            }
        }
    }

    // Expose public API
    window.Cart = {
        addToCart: addToCart,
        removeFromCart: removeFromCart,
        renderCart: renderCart,
        handleCheckout: handleCheckout,
        getCartCount: getCartCount,
        updateCartBadge: updateCartBadge
    };
})();
