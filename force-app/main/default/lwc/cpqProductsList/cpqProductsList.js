import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getProducts from '@salesforce/apex/ProductListController.getProducts';
import createProduct from '@salesforce/apex/ProductListController.createProduct';
import updateProduct from '@salesforce/apex/ProductListController.updateProduct';
import deleteProduct from '@salesforce/apex/ProductListController.deleteProduct';
import toggleProductActive from '@salesforce/apex/ProductListController.toggleProductActive';
import getCurrentUserRole from '@salesforce/apex/CPQAdminController.getCurrentUserRole';

const LS_KEY = 'cpqProductsListViewSettings';

export default class CpqProductsList extends LightningElement {
    @track products = [];
    @track filteredProducts = [];
    @track isModalOpen = false;
    @track isViewDropdownOpen = false;
    @track searchTerm = '';
    @track density = 'default';
    @track isEditMode = false;
    @track currentProductId = null;
    isListenerAdded = false;
    
    @track newProduct = {
        name: '',
        description: '',
        billingUnit: 'Each',
        price: 0,
        cost: 0,
        tags: '',
        active: true,
        city: '',
        state: '',
        country: ''
    };

    @track columns = [
        { id: 'id', label: 'ID', visible: true },
        { id: 'name', label: 'Name', visible: true },
        { id: 'location', label: 'Location', visible: true },
        { id: 'billingUnit', label: 'Billing Unit', visible: true },
        { id: 'price', label: 'Price', visible: true },
        { id: 'cost', label: 'Cost', visible: true },
        { id: 'tags', label: 'Tags', visible: true },
        { id: 'active', label: 'Active', visible: true }
    ];

    @track currentUserRole = 'User';

    @wire(getCurrentUserRole)
    wiredUserRole({ error, data }) {
        if (data) {
            this.currentUserRole = data;
        }
    }

    get canCreate() {
        return this.currentUserRole !== 'User';
    }

    wiredProductsResult;

    connectedCallback() {
        this.loadViewSettings();
    }

    @wire(getProducts)
    wiredProducts(result) {
        this.wiredProductsResult = result;
        if (result.data) {
            this.products = result.data.map((prod, index) => ({
                ...prod,
                counter: index + 1,
                recordUrl: `/lightning/r/CPQ_Product__c/${prod.Id}/view`,
                formattedPrice: this.formatCurrency(prod.Price__c),
                formattedCost: this.formatCurrency(prod.Cost__c)
            }));
            this.filterData();
        } else if (result.error) {
            this.showToast('Error', 'Failed to fetch products', 'error');
        }
    }

    // --- Computed ---

    get visibleColumnCount() {
        return this.columns.filter(col => col.visible).length;
    }

    get tableClass() {
        return `custom-table ${this.density === 'compact' ? 'compact' : ''}`;
    }

    get densityDefaultClass() {
        return `toggle-btn ${this.density === 'default' ? 'active' : ''}`;
    }

    get densityCompactClass() {
        return `toggle-btn ${this.density === 'compact' ? 'active' : ''}`;
    }

    get isColVisible() {
        const visibleMap = {};
        this.columns.forEach(col => {
            visibleMap[col.id] = col.visible;
        });
        return visibleMap;
    }

    get descriptionCharCount() {
        return this.newProduct.description ? this.newProduct.description.length : 0;
    }

    get modalTitle() {
        return this.isEditMode ? 'Edit Product' : 'Create New Product';
    }

    get saveBtnLabel() {
        return this.isEditMode ? (this.isCreating ? 'Updating...' : 'Update') : (this.isCreating ? 'Creating...' : 'Create');
    }

    // --- Handlers ---

    handleSearch(event) {
        this.searchTerm = event.target.value.toLowerCase();
        this.filterData();
    }

    filterData() {
        if (!this.searchTerm) {
            this.filteredProducts = [...this.products];
        } else {
            this.filteredProducts = this.products.filter(prod => 
                prod.Name.toLowerCase().includes(this.searchTerm) ||
                prod.Product_ID__c.toLowerCase().includes(this.searchTerm) ||
                (prod.Tags__c && prod.Tags__c.toLowerCase().includes(this.searchTerm))
            );
        }
    }

    handleNewProduct() {
        this.isEditMode = false;
        this.currentProductId = null;
        this.resetNewProductForm();
        this.isModalOpen = true;
    }

    handleEdit(event) {
        event.preventDefault();
        const productId = event.currentTarget.dataset.id;
        const prod = this.products.find(p => p.Id === productId);
        if (prod) {
            this.isEditMode = true;
            this.currentProductId = productId;
            this.newProduct = {
                name: prod.Name,
                description: prod.Description__c || '',
                billingUnit: prod.Billing_Unit__c,
                price: prod.Price__c,
                cost: prod.Cost__c || 0,
                tags: prod.Tags__c || '',
                active: prod.Active__c,
                city: prod.City__c || '',
                state: prod.State__c || '',
                country: prod.Country__c || ''
            };
            this.isModalOpen = true;
        }
    }

    closeModal() {
        this.isModalOpen = false;
    }

    stopProp(event) {
        event.stopPropagation();
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.type === 'checkbox' || event.target.type === 'toggle' ? event.target.checked : event.target.value;
        this.newProduct[field] = value;
    }

    async saveProduct() {
        if (!this.newProduct.name || this.newProduct.price === undefined || !this.newProduct.billingUnit) {
            this.showToast('Error', 'Please fill in all required fields', 'error');
            return;
        }

        this.isCreating = true;
        const locationStr = [this.newProduct.city, this.newProduct.state, this.newProduct.country].filter(Boolean).join(', ');

        try {
            if (this.isEditMode) {
                await updateProduct({
                    productId: this.currentProductId,
                    name: this.newProduct.name,
                    description: this.newProduct.description,
                    billingUnit: this.newProduct.billingUnit,
                    price: this.newProduct.price,
                    cost: this.newProduct.cost,
                    tags: this.newProduct.tags,
                    active: this.newProduct.active,
                    city: this.newProduct.city,
                    state: this.newProduct.state,
                    country: this.newProduct.country,
                    location: locationStr
                });
                this.showToast('Success', 'Product updated successfully', 'success');
            } else {
                await createProduct({
                    name: this.newProduct.name,
                    description: this.newProduct.description,
                    billingUnit: this.newProduct.billingUnit,
                    price: this.newProduct.price,
                    cost: this.newProduct.cost,
                    tags: this.newProduct.tags,
                    active: this.newProduct.active,
                    city: this.newProduct.city,
                    state: this.newProduct.state,
                    country: this.newProduct.country,
                    location: locationStr
                });
                this.showToast('Success', 'Product created successfully', 'success');
            }
            this.isModalOpen = false;
            await refreshApex(this.wiredProductsResult);
        } catch (error) {
            this.showToast('Error', error.body.message, 'error');
        } finally {
            this.isCreating = false;
        }
    }

    async handleDelete(event) {
        const productId = event.currentTarget.dataset.id;
        if (confirm('Are you sure you want to delete this product?')) {
            try {
                await deleteProduct({ productId });
                this.showToast('Success', 'Product deleted', 'success');
                await refreshApex(this.wiredProductsResult);
            } catch (error) {
                this.showToast('Error', error.body.message, 'error');
            }
        }
    }

    async handleStatusToggle(event) {
        const productId = event.target.dataset.id;
        const active = event.target.checked;
        try {
            await toggleProductActive({ productId, active });
        } catch (error) {
            this.showToast('Error', 'Failed to update status', 'error');
            // Revert UI if needed - refreshApex will do this
            await refreshApex(this.wiredProductsResult);
        }
    }

    handleRefresh() {
        refreshApex(this.wiredProductsResult);
        this.showToast('Refreshed', 'Product list updated', 'info');
    }

    handleImport() {
        this.showToast('Feature Coming Soon', 'CSV Import will be available in the next update.', 'info');
    }

    // --- View Settings ---

    loadViewSettings() {
        try {
            const saved = window.localStorage.getItem(LS_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.density) this.density = data.density;
                if (data.columns && Array.isArray(data.columns)) {
                    this.columns = this.columns.map(col => {
                        const savedCol = data.columns.find(c => c.id === col.id);
                        if (savedCol) col.visible = savedCol.visible;
                        return col;
                    });
                }
            }
        } catch(e) {}
    }

    saveViewSettings() {
        try {
            window.localStorage.setItem(LS_KEY, JSON.stringify({
                density: this.density,
                columns: this.columns.map(c => ({ id: c.id, visible: c.visible }))
            }));
        } catch(e) {}
    }

    toggleViewDropdown(event) {
        if (event) event.stopPropagation();
        this.isViewDropdownOpen = !this.isViewDropdownOpen;
    }

    renderedCallback() {
        if (!this.isListenerAdded) {
            this.clickListener = (event) => {
                const viewDropdown = this.template.querySelector('.view-settings-container');
                const isClickInsideView = viewDropdown && viewDropdown.contains(event.target);
                if (!isClickInsideView) this.isViewDropdownOpen = false;
            };
            document.addEventListener('click', this.clickListener);
            this.isListenerAdded = true;
        }
    }

    disconnectedCallback() {
        if (this.clickListener) {
            document.removeEventListener('click', this.clickListener);
        }
    }

    toggleColumn(event) {
        const colId = event.target.dataset.id;
        this.columns = this.columns.map(col => 
            col.id === colId ? { ...col, visible: event.target.checked } : col
        );
        this.saveViewSettings();
    }

    setDensityDefault() { this.density = 'default'; this.saveViewSettings(); }
    setDensityCompact() { this.density = 'compact'; this.saveViewSettings(); }

    resetViewSettings() {
        this.density = 'default';
        this.columns = this.columns.map(col => ({ ...col, visible: true }));
        this.saveViewSettings();
    }

    // --- Utils ---

    formatCurrency(value) {
        if (value === undefined || value === null) return '—';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(value);
    }

    handleAIAssistant() {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Feature Coming Soon',
            message: 'Our Einstein-powered AI assistant is currently being finalized. Stay tuned for intelligent product recommendations and insights!',
            variant: 'info'
        }));
    }

    resetNewProductForm() {
        this.newProduct = {
            name: '',
            description: '',
            billingUnit: 'Each',
            price: 0,
            cost: 0,
            tags: '',
            active: true,
            city: '',
            state: '',
            country: ''
        };
    }
}
