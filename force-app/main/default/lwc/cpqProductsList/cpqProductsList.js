import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getProducts from '@salesforce/apex/ProductListController.getProducts';
import createProduct from '@salesforce/apex/ProductListController.createProduct';
import deleteProduct from '@salesforce/apex/ProductListController.deleteProduct';
import toggleProductActive from '@salesforce/apex/ProductListController.toggleProductActive';

export default class CpqProductsList extends LightningElement {
    @track products = [];
    @track filteredProducts = [];
    @track isModalOpen = false;
    @track isViewDropdownOpen = false;
    @track searchTerm = '';
    @track density = 'default';
    
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

    wiredProductsResult;

    @wire(getProducts)
    wiredProducts(result) {
        this.wiredProductsResult = result;
        if (result.data) {
            this.products = result.data.map((prod, index) => ({
                ...prod,
                counter: index + 1,
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
        this.resetNewProductForm();
        this.isModalOpen = true;
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

    toggleViewDropdown() {
        this.isViewDropdownOpen = !this.isViewDropdownOpen;
    }

    toggleColumn(event) {
        const colId = event.target.dataset.id;
        this.columns = this.columns.map(col => 
            col.id === colId ? { ...col, visible: event.target.checked } : col
        );
    }

    setDensityDefault() { this.density = 'default'; }
    setDensityCompact() { this.density = 'compact'; }

    resetViewSettings() {
        this.density = 'default';
        this.columns = this.columns.map(col => ({ ...col, visible: true }));
    }

    // --- Utils ---

    formatCurrency(value) {
        if (value === undefined || value === null) return '—';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
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
