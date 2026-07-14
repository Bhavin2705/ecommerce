/* ============================================================
   ShopVault — Products Module (products.js)
   Catalog display, pagination, and admin CRUD.
   NEVER uses innerHTML — all DOM via textContent / createElement.
   ============================================================ */

(function () {
    'use strict';

    var currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    });

    /**
     * Load and display products for the catalog view.
     * @param {number} page
     * @param {number} limit
     */
    async function loadProducts(page, limit) {
        if (!page) page = 1;
        if (!limit) limit = 12;

        var grid = document.getElementById('products-grid');
        if (!grid) return;

        // Show skeleton loading
        grid.replaceChildren();
        for (var s = 0; s < limit; s++) {
            var skel = document.createElement('div');
            skel.className = 'skeleton skeleton-card';
            grid.appendChild(skel);
        }

        try {
            var data = await window.API.apiFetch(
                '/products?page=' + page + '&limit=' + limit
            );

            var products = Array.isArray(data) ? data : (data.items || data.products || []);
            var total = data.total || products.length;

            renderProducts(products, grid);
            renderPagination(page, total, limit);
        } catch (err) {
            grid.replaceChildren();
            var errDiv = document.createElement('div');
            errDiv.className = 'empty-state';
            var errIcon = document.createElement('div');
            errIcon.className = 'empty-icon';
            errIcon.textContent = '⚠️';
            var errText = document.createElement('p');
            errText.textContent = 'Failed to load products: ' + err.message;
            errDiv.appendChild(errIcon);
            errDiv.appendChild(errText);
            grid.appendChild(errDiv);
        }
    }

    /**
     * Render an array of products into the grid container.
     * @param {Array} products
     * @param {HTMLElement} container
     */
    function renderProducts(products, container) {
        container.replaceChildren();

        if (!products || products.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            var emptyIcon = document.createElement('div');
            emptyIcon.className = 'empty-icon';
            emptyIcon.textContent = '🛍️';
            var emptyText = document.createElement('p');
            emptyText.textContent = 'No products available yet.';
            empty.appendChild(emptyIcon);
            empty.appendChild(emptyText);
            container.appendChild(empty);
            return;
        }

        products.forEach(function (product) {
            var card = document.createElement('div');
            card.className = 'product-card';

            // Image area
            var imageArea = document.createElement('div');
            imageArea.className = 'product-card-image';

            if (product.image_url) {
                var img = document.createElement('img');
                img.src = product.image_url;
                img.alt = product.name || 'Product';
                img.loading = 'lazy';
                img.addEventListener('error', function () {
                    img.remove();
                    var ph = document.createElement('span');
                    ph.className = 'placeholder-icon';
                    ph.textContent = '📦';
                    imageArea.appendChild(ph);
                });
                imageArea.appendChild(img);
            } else {
                var placeholder = document.createElement('span');
                placeholder.className = 'placeholder-icon';
                placeholder.textContent = '📦';
                imageArea.appendChild(placeholder);
            }

            card.appendChild(imageArea);

            // Body
            var body = document.createElement('div');
            body.className = 'product-card-body';

            var name = document.createElement('h3');
            name.className = 'product-card-name';
            name.textContent = product.name || 'Untitled';

            var desc = document.createElement('p');
            desc.className = 'product-card-description';
            desc.textContent = product.description || '';

            var footer = document.createElement('div');
            footer.className = 'product-card-footer';

            var price = document.createElement('span');
            price.className = 'product-price';
            price.textContent = currencyFormatter.format(product.price || 0);

            var stockBadge = document.createElement('span');
            var stockQty = product.stock_quantity != null ? product.stock_quantity : 0;
            if (stockQty > 0) {
                stockBadge.className = 'stock-badge in-stock';
                stockBadge.textContent = 'In Stock';
            } else {
                stockBadge.className = 'stock-badge out-of-stock';
                stockBadge.textContent = 'Out of Stock';
            }

            footer.appendChild(price);
            footer.appendChild(stockBadge);

            // Add to cart button
            var addBtn = document.createElement('button');
            addBtn.className = 'btn btn-primary btn-full';
            addBtn.textContent = stockQty > 0 ? 'Add to Cart' : 'Sold Out';
            addBtn.disabled = stockQty <= 0;

            if (stockQty > 0) {
                (function (prod) {
                    addBtn.addEventListener('click', function () {
                        if (window.Cart && window.Cart.addToCart) {
                            window.Cart.addToCart(prod);
                        }
                    });
                })(product);
            }

            body.appendChild(name);
            body.appendChild(desc);
            body.appendChild(footer);
            body.appendChild(addBtn);
            card.appendChild(body);

            container.appendChild(card);
        });
    }

    /**
     * Render pagination controls.
     * @param {number} currentPage
     * @param {number} total
     * @param {number} limit
     */
    function renderPagination(currentPage, total, limit) {
        var container = document.getElementById('pagination');
        if (!container) return;

        container.replaceChildren();

        var totalPages = Math.ceil(total / limit);
        if (totalPages <= 1) return;

        // Previous button
        var prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '‹';
        prevBtn.disabled = currentPage <= 1;
        prevBtn.addEventListener('click', function () {
            loadProducts(currentPage - 1, limit);
        });
        container.appendChild(prevBtn);

        // Page buttons
        var startPage = Math.max(1, currentPage - 2);
        var endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            container.appendChild(createPageBtn(1, currentPage, limit));
            if (startPage > 2) {
                var dots = document.createElement('span');
                dots.className = 'pagination-btn';
                dots.textContent = '…';
                dots.style.cursor = 'default';
                container.appendChild(dots);
            }
        }

        for (var p = startPage; p <= endPage; p++) {
            container.appendChild(createPageBtn(p, currentPage, limit));
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                var dots2 = document.createElement('span');
                dots2.className = 'pagination-btn';
                dots2.textContent = '…';
                dots2.style.cursor = 'default';
                container.appendChild(dots2);
            }
            container.appendChild(createPageBtn(totalPages, currentPage, limit));
        }

        // Next button
        var nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = '›';
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.addEventListener('click', function () {
            loadProducts(currentPage + 1, limit);
        });
        container.appendChild(nextBtn);
    }

    /**
     * Helper: create a pagination page button.
     */
    function createPageBtn(page, currentPage, limit) {
        var btn = document.createElement('button');
        btn.className = 'pagination-btn';
        if (page === currentPage) btn.className += ' active';
        btn.textContent = String(page);
        btn.addEventListener('click', function () {
            loadProducts(page, limit);
        });
        return btn;
    }

    /* ============================================================
       ADMIN FUNCTIONS
       ============================================================ */

    /**
     * Load all products for admin management table.
     */
    async function loadAdminProducts() {
        var container = document.getElementById('admin-products-table');
        if (!container) return;

        try {
            var data = await window.API.apiFetch('/products?page=1&limit=100');
            var products = Array.isArray(data) ? data : (data.items || data.products || []);
            renderAdminTable(products, container);
        } catch (err) {
            container.replaceChildren();
            var errP = document.createElement('p');
            errP.textContent = 'Failed to load products: ' + err.message;
            errP.style.color = 'var(--color-error)';
            container.appendChild(errP);
        }
    }

    /**
     * Render the admin products table.
     * @param {Array} products
     * @param {HTMLElement} container
     */
    function renderAdminTable(products, container) {
        container.replaceChildren();

        if (!products || products.length === 0) {
            var empty = document.createElement('p');
            empty.textContent = 'No products found.';
            empty.style.color = 'var(--text-muted)';
            empty.style.padding = '24px';
            container.appendChild(empty);
            return;
        }

        var table = document.createElement('table');
        table.className = 'admin-table';

        // Thead
        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        var headers = ['Name', 'SKU', 'Price', 'Stock', 'Actions'];
        headers.forEach(function (h) {
            var th = document.createElement('th');
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Tbody
        var tbody = document.createElement('tbody');
        products.forEach(function (product) {
            var row = document.createElement('tr');

            var tdName = document.createElement('td');
            tdName.textContent = product.name || '';

            var tdSku = document.createElement('td');
            tdSku.textContent = product.sku || '';

            var tdPrice = document.createElement('td');
            tdPrice.textContent = currencyFormatter.format(product.price || 0);

            var tdStock = document.createElement('td');
            tdStock.textContent = String(product.stock_quantity != null ? product.stock_quantity : 0);

            var tdActions = document.createElement('td');
            var editBtn = document.createElement('button');
            editBtn.className = 'btn btn-outline btn-sm';
            editBtn.textContent = 'Edit';
            (function (prod) {
                editBtn.addEventListener('click', function () {
                    handleEditProduct(prod);
                });
            })(product);
            tdActions.appendChild(editBtn);

            row.appendChild(tdName);
            row.appendChild(tdSku);
            row.appendChild(tdPrice);
            row.appendChild(tdStock);
            row.appendChild(tdActions);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        container.appendChild(table);
    }

    /**
     * Handle add product form submission.
     * @param {Event} e
     */
    async function handleAddProduct(e) {
        e.preventDefault();

        var form = document.getElementById('add-product-form');
        if (!form) return;

        var sku = document.getElementById('add-sku').value.trim();
        var name = document.getElementById('add-name').value.trim();
        var description = document.getElementById('add-description').value.trim();
        var imageUrl = document.getElementById('add-image-url').value.trim();
        var price = parseFloat(document.getElementById('add-price').value);
        var stock = parseInt(document.getElementById('add-stock').value, 10);

        if (!sku || !name || isNaN(price)) {
            window.API.showToast('Please fill in required fields (SKU, Name, Price)', 'error');
            return;
        }

        try {
            await window.API.apiFetch('/products', {
                method: 'POST',
                body: JSON.stringify({
                    sku: sku,
                    name: name,
                    description: description || '',
                    image_url: imageUrl || null,
                    price: price,
                    stock_quantity: isNaN(stock) ? 0 : stock
                })
            });

            window.API.showToast('Product added successfully!', 'success');
            form.reset();
            loadAdminProducts();
        } catch (err) {
            window.API.showToast(err.message || 'Failed to add product', 'error');
        }
    }

    /**
     * Open edit modal and pre-fill form for a product.
     * @param {object} product
     */
    function handleEditProduct(product) {
        var modal = document.getElementById('edit-modal');
        if (!modal) return;

        document.getElementById('edit-product-id').value = product.id || '';
        document.getElementById('edit-name').value = product.name || '';
        document.getElementById('edit-description').value = product.description || '';
        document.getElementById('edit-image-url').value = product.image_url || '';
        document.getElementById('edit-price').value = product.price || '';
        document.getElementById('edit-stock').value = product.stock_quantity != null ? product.stock_quantity : '';

        modal.classList.remove('hidden');
    }

    /**
     * Handle edit product form submission.
     * @param {Event} e
     */
    async function handleEditSubmit(e) {
        e.preventDefault();

        var productId = document.getElementById('edit-product-id').value;
        if (!productId) return;

        var name = document.getElementById('edit-name').value.trim();
        var description = document.getElementById('edit-description').value.trim();
        var imageUrl = document.getElementById('edit-image-url').value.trim();
        var price = parseFloat(document.getElementById('edit-price').value);
        var stock = parseInt(document.getElementById('edit-stock').value, 10);

        if (!name || isNaN(price)) {
            window.API.showToast('Name and price are required', 'error');
            return;
        }

        try {
            await window.API.apiFetch('/products/' + productId, {
                method: 'PUT',
                body: JSON.stringify({
                    name: name,
                    description: description || '',
                    image_url: imageUrl || null,
                    price: price,
                    stock_quantity: isNaN(stock) ? 0 : stock
                })
            });

            window.API.showToast('Product updated!', 'success');
            closeEditModal();
            loadAdminProducts();
        } catch (err) {
            window.API.showToast(err.message || 'Failed to update', 'error');
        }
    }

    /**
     * Close the edit product modal.
     */
    function closeEditModal() {
        var modal = document.getElementById('edit-modal');
        if (modal) modal.classList.add('hidden');
    }

    // Wire up admin event listeners on DOM ready
    document.addEventListener('DOMContentLoaded', function () {
        var addForm = document.getElementById('add-product-form');
        if (addForm) {
            addForm.addEventListener('submit', handleAddProduct);
        }

        var editForm = document.getElementById('edit-product-form');
        if (editForm) {
            editForm.addEventListener('submit', handleEditSubmit);
        }

        var editCancelBtn = document.getElementById('edit-cancel-btn');
        if (editCancelBtn) {
            editCancelBtn.addEventListener('click', closeEditModal);
        }

        // Close modal on overlay click
        var modalOverlay = document.querySelector('#edit-modal .modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', closeEditModal);
        }
    });

    // Expose public API
    window.Products = {
        loadProducts: loadProducts,
        loadAdminProducts: loadAdminProducts,
        handleAddProduct: handleAddProduct
    };
})();
