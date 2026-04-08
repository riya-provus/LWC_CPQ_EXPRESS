import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getQuoteSummary from '@salesforce/apex/QuoteExplorerController.getQuoteSummary';
import getQuoteBreakdown from '@salesforce/apex/QuoteExplorerController.getQuoteBreakdown';
import getApprovalHistory from '@salesforce/apex/QuoteExplorerController.getApprovalHistory';
import getQuoteLineItems from '@salesforce/apex/QuoteExplorerController.getQuoteLineItems';
import saveQuoteLineItems from '@salesforce/apex/QuoteExplorerController.saveQuoteLineItems';
import submitForApproval from '@salesforce/apex/QuoteExplorerController.submitForApproval';
import updateQuoteStatus from '@salesforce/apex/QuoteExplorerController.updateQuoteStatus';
import deleteQuoteLineItem from '@salesforce/apex/QuoteExplorerController.deleteQuoteLineItem';

export default class CpqQuoteExplorer extends LightningElement {
    @api quoteId;

    @track summary = {};
    @track breakdown = [];
    @track approvalHistory = [];
    @track lineItems = [];
    @track draftItems = [];
    @track activeTab = 'Summary';
    @track isLoading = true;
    @track isModalOpen = false;
    @track isSubmitting = false;
    @track isProcessingAction = false;

    // Chart Data (Mocking Phase data for now as researched)
    @track phaseBreakdown = [
        { label: 'Discovery', value: 12500, color: '#3b82f6' },
        { label: 'Implementation', value: 45000, color: '#10b981' },
        { label: 'Go-Live', value: 8000, color: '#f59e0b' }
    ];

    _wiredSummaryResult;
    _wiredItemsResult;
    _wiredHistoryResult;

    @wire(getQuoteSummary, { quoteId: '$quoteId' })
    wiredSummary(result) {
        this._wiredSummaryResult = result;
        if (result.data) {
            this.summary = result.data;
            this.isLoading = false;
        } else if (result.error) {
            console.error('Error fetching summary:', result.error);
            this.isLoading = false;
        }
    }

    @wire(getQuoteLineItems, { quoteId: '$quoteId' })
    wiredItems(result) {
        this._wiredItemsResult = result;
        if (result.data) {
            this.lineItems = result.data.map(item => ({
                ...item,
                isNew: false
            }));
            this.draftItems = JSON.parse(JSON.stringify(this.lineItems));
        }
    }

    @wire(getQuoteBreakdown, { quoteId: '$quoteId' })
    wiredBreakdown({ error, data }) {
        // Now handled by calculatedBreakdown getter instead, we just keep this to refresh state or we can ignore it totally.
    }

    @wire(getApprovalHistory, { quoteId: '$quoteId' })
    wiredHistory(result) {
        this._wiredHistoryResult = result;
        const { error, data } = result;
        if (data) {
            this.approvalHistory = data.map(step => ({
                ...step,
                formattedDate: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(step.createdDate)),
                statusClass: this.getApprovalStatusClass(step.status)
            }));
        }
    }

    getCategoryColor(label) {
        if (label.includes('Labor')) return '#3b82f6'; // Blue
        if (label.includes('Product')) return '#10b981'; // Green
        if (label.includes('Addon')) return '#f59e0b'; // Amber
        return '#6b7280'; // Gray
    }

    getApprovalStatusClass(status) {
        if (status === 'Approved') return 'status-approved';
        if (status === 'Rejected') return 'status-rejected';
        if (status === 'Pending') return 'status-pending';
        return 'status-step';
    }

    calculatePercentages() {
        // Logic moved to getters
    }

    // Tab Handlers
    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('back'));
    }

    get canSubmitForApproval() {
        const status = this.summary && this.summary.status ? this.summary.status : '';
        return status === 'Draft' || status === '';
    }

    get isInReview() {
        return this.summary && this.summary.status === 'In Review';
    }

    get submitBtnLabel() {
        return this.isSubmitting ? 'Submitting...' : 'Submit for Approval';
    }

    get isReadOnly() {
        return this.summary && this.summary.status === 'Approved';
    }

    get showEditDescriptionIcon() {
        return !this.isReadOnly && !this.summary.description;
    }

    async handleSubmitForApproval() {
        if (!this.quoteId) return;

        // Validation: at least one line item must exist
        if (!this.draftItems || this.draftItems.length === 0) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Cannot Submit',
                message: 'Please add at least one line item to the quote before submitting for approval.',
                variant: 'error',
                mode: 'sticky'
            }));
            return;
        }

        this.isSubmitting = true;
        try {
            const result = await submitForApproval({ quoteId: this.quoteId });
            const message = result === 'SUBMITTED'
                ? 'Quote submitted into the approval workflow successfully.'
                : 'Quote is now In Review and awaiting approval.';
            this.dispatchEvent(new ShowToastEvent({
                title: 'Submitted for Approval',
                message: message,
                variant: 'success'
            }));
            await refreshApex(this._wiredSummaryResult);
            await refreshApex(this._wiredHistoryResult);
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Submission Failed',
                message: error.body ? error.body.message : error.message,
                variant: 'error'
            }));
        } finally {
            this.isSubmitting = false;
        }
    }

    async handleApprove() {
        await this._updateStatus('Approved', 'Quote Approved', 'The quote has been approved successfully.');
    }

    async handleReject() {
        await this._updateStatus('Rejected', 'Quote Rejected', 'The quote has been rejected.');
    }

    async handleRecall() {
        await this._updateStatus('Draft', 'Quote Recalled', 'The quote has been recalled back to Draft.');
    }

    async _updateStatus(newStatus, title, message) {
        this.isProcessingAction = true;
        try {
            await updateQuoteStatus({ quoteId: this.quoteId, newStatus: newStatus });
            this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'success' }));
            await refreshApex(this._wiredSummaryResult);
            await refreshApex(this._wiredHistoryResult);
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Action Failed',
                message: error.body ? error.body.message : error.message,
                variant: 'error'
            }));
        } finally {
            this.isProcessingAction = false;
        }
    }

    // Modal Integration
    openAddItemModal() {
        if (this.isReadOnly) return;
        this.isModalOpen = true;
    }

    closeAddItemModal() {
        this.isModalOpen = false;
    }

    handleItemsAdded(event) {
        if (this.isReadOnly) return;
        const selectedItems = event.detail.items;
        const newDrafts = selectedItems.map((item, index) => ({
            id: `new-${Date.now()}-${index}`,
            isNew: true,
            productId: item.Id,
            name: item.Name,
            family: item.Family,
            phase: 'Implementation',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            quantity: 1,
            baseRate: item.UnitPrice || 0,
            unitPrice: item.UnitPrice || 0,
            unitCost: item.Cost || 0,
            discount: 0,
            totalValue: item.UnitPrice || 0
        }));

        this.draftItems = [...this.draftItems, ...newDrafts];
        this.isModalOpen = false;
    }

    async handleDeleteItem(event) {
        if (this.isReadOnly) return;
        const itemId = event.currentTarget.dataset.id;
        const isNew = event.currentTarget.dataset.isNew === 'true';

        // For unsaved items: just remove from draft array, no server call needed
        if (isNew) {
            this.draftItems = this.draftItems.filter(item => item.id !== itemId);
            return;
        }

        // For saved items: delete from database first
        try {
            await deleteQuoteLineItem({ itemId: itemId });
            this.draftItems = this.draftItems.filter(item => item.id !== itemId);
            // Refresh summary so rollup totals update
            await refreshApex(this._wiredSummaryResult);
            await refreshApex(this._wiredItemsResult);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Deleted',
                message: 'Line item removed from quote.',
                variant: 'success'
            }));
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Delete Failed',
                message: error.body ? error.body.message : error.message,
                variant: 'error'
            }));
        }
    }

    // Inline Editing
    handleInputChange(event) {
        if (this.isReadOnly) return;
        const id = event.target.dataset.id;
        const field = event.target.dataset.field;
        const value = event.target.value;

        this.draftItems = this.draftItems.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                
                if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
                    const q = parseFloat(updatedItem.quantity) || 0;
                    const p = parseFloat(updatedItem.unitPrice) || 0;
                    const d = parseFloat(updatedItem.discount) || 0;
                    updatedItem.totalValue = q * p * (1 - (d / 100));
                    
                    if (field === 'unitPrice') {
                        updatedItem.baseRate = p; // Base rate stays synced with unit price if user modifies unit price
                    }
                }
                return updatedItem;
            }
            return item;
        });
    }

    async handleSave() {
        if (this.isReadOnly) return;
        this.isLoading = true;
        try {
            const itemsToSave = this.draftItems.map(item => {
                const qli = {
                    Quote__c: this.quoteId,
                    Quantity__c: parseFloat(item.quantity) || 0,
                    UnitPrice__c: parseFloat(item.unitPrice) || 0,
                    Discount__c: parseFloat(item.discount) || 0,
                    Phase__c: item.phase,
                    Start_Date__c: item.startDate,
                    End_Date__c: item.endDate,
                    Item_Type__c: item.family,
                    Item_Name__c: item.name,
                    Total_Price__c: item.totalValue
                };
                if (!item.isNew) {
                    qli.Id = item.id;
                } else {
                    if (item.family === 'Labor') {
                        qli.Resource_Role__c = item.productId;
                    } else if (item.family === 'Add-on') {
                        qli.CPQ_Addon__c = item.productId;
                    } else {
                        qli.CPQ_Product__c = item.productId;
                    }
                }
                return qli;
            });

            await saveQuoteLineItems({ items: itemsToSave });
            
            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Quote saved successfully',
                variant: 'success'
            }));
            
            await refreshApex(this._wiredSummaryResult);
            await refreshApex(this._wiredItemsResult);
        } catch (error) {
            console.error('Error saving quote:', error);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error saving quote',
                message: error.body ? error.body.message : error.message,
                variant: 'error'
            }));
        } finally {
            this.isLoading = false;
        }
    }

    // Timeline Logic
    get timelineData() {
        if (!this.draftItems || this.draftItems.length === 0) return [];

        const sorted = [...this.draftItems].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        const firstDate = new Date(sorted[0].startDate);
        const lastDate = sorted.reduce((max, item) => {
            const d = new Date(item.endDate);
            return d > max ? d : max;
        }, new Date());

        // Calculate months range
        const startYear = firstDate.getFullYear();
        const startMonth = firstDate.getMonth();
        const endYear = lastDate.getFullYear();
        const endMonth = lastDate.getMonth();
        const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

        return this.draftItems.map(item => {
            const iStart = new Date(item.startDate);
            const iEnd = new Date(item.endDate);
            const startOffset = ((iStart.getFullYear() - startYear) * 12 + (iStart.getMonth() - startMonth));
            const duration = ((iEnd.getFullYear() - iStart.getFullYear()) * 12 + (iEnd.getMonth() - iStart.getMonth())) + 1;

            return {
                ...item,
                timelineStyle: `margin-left: ${(startOffset / totalMonths) * 100}%; width: ${(duration / totalMonths) * 100}%; background-color: ${this.getCategoryColor(item.family)};`,
                durationStr: this.getDurationStr(iStart, iEnd),
                icon: this.getCategoryIcon(item.family)
            };
        });
    }

    get timelineData() {
        let earliestDate = new Date('2099-01-01');
        this.draftItems.forEach(item => {
            if (item.startDate && new Date(item.startDate) < earliestDate) {
                earliestDate = new Date(item.startDate);
            }
        });

        if (earliestDate.getFullYear() === 2099) return [];

        return this.draftItems.map(item => {
            if (!item.startDate || !item.endDate) return null;
            
            const start = new Date(item.startDate);
            const end = new Date(item.endDate);
            const startDiffMonths = (start.getFullYear() - earliestDate.getFullYear()) * 12 + start.getMonth() - earliestDate.getMonth();
            const durationMonths = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
            
            const leftPct = Math.max(0, startDiffMonths * 8.33);
            const widthPct = Math.max(8.33, durationMonths * 8.33);

            const familyLower = item.family === 'Product' ? 'product' : (item.family === 'Add-on' ? 'addon' : 'labor');
            
            return {
                id: item.id,
                name: item.name,
                icon: item.family === 'Product' ? 'utility:package' : (item.family === 'Add-on' ? 'utility:ad_set' : 'utility:user'),
                durationStr: `${Math.round(durationMonths)} month${Math.round(durationMonths) !== 1 ? 's' : ''}`,
                timelineStyle: `grid-column: 1 / span ${Math.max(1, Math.round(durationMonths))}; margin-left: ${leftPct}%; width: auto;`,
                pillClass: `gantt-bar color-${familyLower}`,
                dotClass: `dot ${familyLower}`,
                textClass: `name color-${familyLower}`,
                iconStyle: `--sds-c-icon-color-foreground-default: currentColor;`
            };
        }).filter(t => t !== null);
    }

    get timelineHeaders() {
        return []; 
    }

    getDurationStr(start, end) {
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays < 30) return `${diffDays} days`;
        if (diffDays < 365) return `about ${Math.round(diffDays / 30)} months`;
        return `over ${Math.round(diffDays / 365)} years`;
    }

    getCategoryIcon(label) {
        if (label.includes('Labor')) return 'utility:user';
        if (label.includes('Product')) return 'utility:package';
        return 'utility:ad_set';
    }

    // Formatters & Calculators
    get calculatedSubtotal() {
        return this.draftItems.reduce((acc, item) => {
            return acc + ((item.quantity || 0) * (item.unitPrice || 0));
        }, 0);
    }

    get calculatedTotal() {
        return this.draftItems.reduce((acc, item) => acc + (item.totalValue || 0), 0);
    }

    get calculatedDiscountString() {
        const subtotal = this.calculatedSubtotal;
        const total = this.calculatedTotal;
        const discountAmt = total - subtotal;
        
        if (subtotal === 0 || discountAmt === 0) return '$0.00 (0.0%)';
        
        const discountPct = (discountAmt / subtotal) * 100;
        return `${discountAmt < 0 ? '-' : ''}$${Math.abs(discountAmt).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${discountPct.toFixed(1)}%)`;
    }

    get calculatedMargin() {
        const totalRev = this.calculatedTotal;
        const totalCost = this.draftItems.reduce((acc, item) => {
            return acc + ((item.quantity || 0) * (item.unitCost || 0));
        }, 0);
        
        const marginAmt = totalRev - totalCost;
        if (totalRev === 0) return `$0.00 (0.00%)`;
        
        const marginPct = (marginAmt / totalRev) * 100;
        return `$${marginAmt.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${marginPct.toFixed(1)}%)`;
    }
    
    get formattedSubtotal() { return this.formatCurrency(this.calculatedSubtotal); }
    get formattedTotal() { return this.formatCurrency(this.calculatedTotal); }
    
    get formattedMargin() {
        return this.calculatedMargin;
    }
    
    get formattedDiscount() {
        return this.calculatedDiscountString;
    }
    
    get formattedGrandTotal() {
        let total = this.calculatedSubtotal;
        if (this.summary.discount) total = total * (1 - (this.summary.discount/100));
        return this.formatCurrency(total);
    }
    
    get formattedCreatedDate() { 
        if(!this.summary.createdDate) return '';
        const d = new Date(this.summary.createdDate);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    get formattedExpDate() { 
        if(!this.summary.expirationDate) return '';
        const d = new Date(this.summary.expirationDate);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    formatCurrency(val) {
        if (!val) return '$0.00';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }

    get tabs() {
        const tabList = ['Summary', 'Line Items', 'Timeline', 'Generated PDFs'];
        return tabList.map(tab => ({
            name: tab,
            class: tab === this.activeTab ? 'tab-item active' : 'tab-item'
        }));
    }

    get isSummaryActive() { return this.activeTab === 'Summary'; }
    get isLineItemsActive() { return this.activeTab === 'Line Items'; }
    get isTimelineActive() { return this.activeTab === 'Timeline'; }

    // Calculated breakdowns
    get laborRevenue() { return this.formatCurrency(this.findCalculatedValue('Labor')); }
    get productRevenue() { return this.formatCurrency(this.findCalculatedValue('Product')); }
    get addonRevenue() { return this.formatCurrency(this.findCalculatedValue('Add-on')); }

    findCalculatedValue(label) {
        if (!this.draftItems) return 0;
        return this.draftItems.filter(i => i.family === label).reduce((sum, item) => sum + (parseFloat(item.totalValue) || 0), 0);
    }

    get calculatedBreakdown() {
        const total = this.calculatedSubtotal;
        if (total === 0) return [];
        
        const categories = [ { label: 'Product', family: 'Product' }, { label: 'Addon', family: 'Add-on' }, { label: 'Labor', family: 'Labor' } ];
        
        return categories.map(cat => {
            const val = this.findCalculatedValue(cat.family);
            const percentage = total > 0 ? Math.round((val / total) * 100) : 0;
            const color = this.getCategoryColor(cat.label);
            return {
                label: cat.family,
                value: val,
                percentage: percentage,
                color: color,
                style: `width: ${percentage}%; background-color: ${color};`
            };
        }).filter(c => c.value > 0);
    }
}
