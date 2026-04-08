import { LightningElement, track, api, wire } from 'lwc';
import getSelectionData from '@salesforce/apex/QuoteExplorerController.getSelectionData';

export default class CpqAddItemModal extends LightningElement {
    @track products = [];
    @track resourceRoles = [];
    @track currentTab = 'ResourceRoles';
    @track searchTerm = '';
    @track selectedIds = new Set();
    @track isLoading = true;

    @wire(getSelectionData)
    wiredData({ error, data }) {
        if (data) {
            const _products = data.products ? data.products.map(p => ({
                Id: p.Id,
                Name: p.Name,
                Family: 'Product',
                Description: p.Description__c || 'No description available',
                UnitPrice: p.Price__c || 0,
                Cost: p.Cost__c || 0
            })) : [];

            const _addons = data.addons ? data.addons.map(a => ({
                Id: a.Id,
                Name: a.Name,
                Family: 'Add-on',
                Description: a.Description__c || 'No description available',
                UnitPrice: a.Price__c || 0,
                Cost: a.Cost__c || 0
            })) : [];

            this.products = [..._products, ..._addons];
            this.resourceRoles = data.resourceRoles.map(r => ({
                Id: r.Id,
                Name: r.Name,
                Family: 'Labor',
                Description: r.Description__c || 'No description available',
                UnitPrice: r.Price__c || 0,
                Cost: 0,
                BillingUnit: r.Billing_Unit__c
            }));
            this.isLoading = false;
        } else if (error) {
            console.error('Error fetching selection data:', error);
            this.isLoading = false;
        }
    }

    get tabs() {
        const roleCount = this.resourceRoles.filter(r => this.selectedIds.has(r.Id)).length;
        const productItems = this.products.filter(p => p.Family === 'Product');
        const productCount = productItems.filter(p => this.selectedIds.has(p.Id)).length;
        const addonItems = this.products.filter(p => p.Family === 'Add-on');
        const addonCount = addonItems.filter(p => this.selectedIds.has(p.Id)).length;

        return [
            { id: 'ResourceRoles', label: 'Resource Roles', icon: 'utility:user', count: roleCount, className: this.currentTab === 'ResourceRoles' ? 'tab-btn active' : 'tab-btn' },
            { id: 'Products', label: 'Products', icon: 'utility:package', count: productCount, className: this.currentTab === 'Products' ? 'tab-btn active' : 'tab-btn' },
            { id: 'Add-ons', label: 'Add-ons', icon: 'utility:ad_set', count: addonCount, className: this.currentTab === 'Add-ons' ? 'tab-btn active' : 'tab-btn' }
        ];
    }

    get filteredItems() {
        let items = [];
        if (this.currentTab === 'ResourceRoles') {
            items = this.resourceRoles;
        } else if (this.currentTab === 'Products') {
            items = this.products.filter(p => p.Family === 'Product');
        } else if (this.currentTab === 'Add-ons') {
            items = this.products.filter(p => p.Family === 'Add-on');
        }

        if (this.searchTerm) {
            const lowerSearch = this.searchTerm.toLowerCase();
            items = items.filter(i => 
                i.Name.toLowerCase().includes(lowerSearch) || 
                i.Description.toLowerCase().includes(lowerSearch)
            );
        }

        return items.map(i => ({
            ...i,
            selected: this.selectedIds.has(i.Id),
            cardClass: this.selectedIds.has(i.Id) ? 'item-card selected' : 'item-card',
            formattedPrice: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(i.UnitPrice) + (i.BillingUnit ? `/${i.BillingUnit}` : '')
        }));
    }

    get selectedCount() {
        return this.selectedIds.size;
    }

    get isNoneSelected() {
        return this.selectedIds.size === 0;
    }

    get hasItems() {
        return this.filteredItems.length > 0;
    }

    handleTabClick(event) {
        this.currentTab = event.currentTarget.dataset.id;
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    handleItemSelect(event) {
        const itemId = event.currentTarget.dataset.id;
        if (this.selectedIds.has(itemId)) {
            this.selectedIds.delete(itemId);
        } else {
            this.selectedIds.add(itemId);
        }
        this.selectedIds = new Set(this.selectedIds);
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleAdd() {
        const allItems = [...this.products, ...this.resourceRoles];
        const selectedItems = allItems.filter(item => this.selectedIds.has(item.Id));
        this.dispatchEvent(new CustomEvent('add', {
            detail: { items: selectedItems }
        }));
    }
}
