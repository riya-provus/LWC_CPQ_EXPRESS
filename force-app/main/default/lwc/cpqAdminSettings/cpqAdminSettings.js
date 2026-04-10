import { LightningElement, track, wire } from 'lwc';
import getSettings    from '@salesforce/apex/CPQAdminController.getSettings';
import saveSettings   from '@salesforce/apex/CPQAdminController.saveSettings';
import getTeamData    from '@salesforce/apex/CPQAdminController.getTeamData';
import createTeamMember from '@salesforce/apex/CPQAdminController.createTeamMember';
import updateUserRole from '@salesforce/apex/CPQAdminController.updateUserRole';
import toggleUserStatus from '@salesforce/apex/CPQAdminController.toggleUserStatus';
import getCurrentUserRole from '@salesforce/apex/CPQAdminController.getCurrentUserRole';
import { refreshApex } from '@salesforce/apex';

const AVATAR_COLORS = [
    '#4f46e5','#0891b2','#059669','#d97706','#dc2626',
    '#7c3aed','#db2777','#16a34a','#ea580c','#0284c7'
];

const DEFAULT_SECTIONS = [
    { id: 'header',           label: 'Header',             visible: true },
    { id: 'billTo',           label: 'Bill to',            visible: true },
    { id: 'projectOverview',  label: 'Project overview',   visible: true },
    { id: 'priceBreakdown',   label: 'Price breakdown',    visible: true },
    { id: 'summary',          label: 'Summary',            visible: true },
    { id: 'milestones',       label: 'Milestones',         visible: true },
    { id: 'termsAndConditions', label: 'Terms and conditions', visible: true }
];

export default class CpqAdminSettings extends LightningElement {

    // ── Navigation ──────────────────────────────────────────────
    @track activeSection = 'companyInfo';

    get isCompanyInfo() { return this.activeSection === 'companyInfo'; }
    get isPdf()         { return this.activeSection === 'pdf'; }
    get isTeam()        { return this.activeSection === 'team'; }

    get navClass_companyInfo() { return this.activeSection === 'companyInfo' ? 'nav-btn active' : 'nav-btn'; }
    get navClass_pdf()         { return this.activeSection === 'pdf'         ? 'nav-btn active' : 'nav-btn'; }
    get navClass_team()        { return this.activeSection === 'team'        ? 'nav-btn active' : 'nav-btn'; }

    handleNavClick(event) {
        this.activeSection = event.currentTarget.dataset.section;
        this.saveSuccess = false;
        this.saveError   = null;
        if (this.activeSection === 'team' && !this._teamLoaded) {
            this.loadTeamData();
        }
    }

    // ── Settings (Company Info + PDF) ────────────────────────────
    @track settings = {
        companyName: '', companyEmail: '', companyPhone: '', companyWebsite: '',
        companyAddress: '', companyCity: '', companyState: '', companyZip: '', companyCountry: '',
        brandLogoUrl: '',
        pdfFormat: 'Standard', pdfRoundValues: true, pdfDecimalPlaces: 2,
        pdfShowDiscount: true, pdfDetailedLineItems: true,
        pdfFooterText: '', pdfSectionLayout: ''
    };

    @track pdfSections = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
    @track logoPreviewUrl = null;
    @track isSaving    = false;
    @track saveSuccess = false;
    @track saveError   = null;

    _wiredSettingsResult;
    @track currentUserRole = 'User';

    @wire(getCurrentUserRole)
    wiredUserRole({ error, data }) {
        if (data) {
            this.currentUserRole = data;
        } else if (error) {
            console.error('Error fetching user role:', error);
        }
    }

    get showAddMemberButton() {
        return this.currentUserRole === 'Admin';
    }

    @wire(getSettings)
    wiredSettings(result) {
        this._wiredSettingsResult = result;
        if (result.data) {
            const d = result.data;
            this.settings = {
                companyName:          d.Company_Name__c    || '',
                companyEmail:         d.Company_Email__c   || '',
                companyPhone:         d.Company_Phone__c   || '',
                companyWebsite:       d.Company_Website__c || '',
                companyAddress:       d.Company_Address__c || '',
                companyCity:          d.Company_City__c    || '',
                companyState:         d.Company_State__c   || '',
                companyZip:           d.Company_Zip__c     || '',
                companyCountry:       d.Company_Country__c || '',
                brandLogoUrl:         d.Brand_Logo_URL__c  || '',
                pdfFormat:            d.PDF_Format__c      || 'Standard',
                pdfRoundValues:       d.PDF_Round_Values__c !== false,
                pdfDecimalPlaces:     d.PDF_Decimal_Places__c != null ? d.PDF_Decimal_Places__c : 2,
                pdfShowDiscount:      d.PDF_Show_Discount__c !== false,
                pdfDetailedLineItems: d.PDF_Detailed_Line_Items__c !== false,
                pdfFooterText:        d.PDF_Footer_Text__c   || '',
                pdfSectionLayout:     d.PDF_Section_Layout__c || ''
            };
            this.logoPreviewUrl = d.Brand_Logo_URL__c || null;
            if (d.PDF_Section_Layout__c) {
                try { this.pdfSections = JSON.parse(d.PDF_Section_Layout__c); }
                catch(e) { this.pdfSections = JSON.parse(JSON.stringify(DEFAULT_SECTIONS)); }
            }
        }
    }

    handleFieldChange(event) {
        const key = event.currentTarget.dataset.key;
        this.settings = { ...this.settings, [key]: event.target.value };
    }

    handleCheckboxChange(event) {
        const key = event.currentTarget.dataset.key;
        this.settings = { ...this.settings, [key]: event.target.checked };
    }

    handleSectionToggle(event) {
        const sid = event.currentTarget.dataset.sectionid;
        this.pdfSections = this.pdfSections.map(s =>
            s.id === sid ? { ...s, visible: event.target.checked } : s
        );
    }

    async handleSaveSettings() {
        this.isSaving    = true;
        this.saveSuccess = false;
        this.saveError   = null;
        try {
            const payload = {
                ...this.settings,
                pdfSectionLayout: JSON.stringify(this.pdfSections)
            };
            await saveSettings({ settingsJson: JSON.stringify(payload) });
            this.saveSuccess = true;
            if (this._wiredSettingsResult) await refreshApex(this._wiredSettingsResult);
        } catch (e) {
            this.saveError = e.body ? e.body.message : e.message;
        } finally {
            this.isSaving = false;
        }
    }

    handleCancel() {
        if (this._wiredSettingsResult) refreshApex(this._wiredSettingsResult);
        this.saveSuccess = false;
        this.saveError   = null;
    }

    // ── Logo Upload ──────────────────────────────────────────────
    handleLogoClick(event) {
        event.stopPropagation();
        this.template.querySelector('.hidden-file-input').click();
    }

    handleDragOver(event) { event.preventDefault(); }

    handleLogoDrop(event) {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) this._previewFile(file);
    }

    handleLogoFileChange(event) {
        const file = event.target.files[0];
        if (file) this._previewFile(file);
    }

    _previewFile(file) {
        if (file.size > 2 * 1024 * 1024) {
            this.saveError = 'File size must be under 2 MB.';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            this.logoPreviewUrl = e.target.result;
            this.settings = { ...this.settings, brandLogoUrl: e.target.result };
        };
        reader.readAsDataURL(file);
    }

    handleLogoRemove(event) {
        event.stopPropagation();
        this.logoPreviewUrl = null;
        this.settings = { ...this.settings, brandLogoUrl: '' };
    }

    // ── Team ─────────────────────────────────────────────────────
    @track totalSeats     = 0;
    @track usedSeats      = 0;
    @track availableSeats = 0;
    @track users          = [];
    @track _teamLoaded    = false;
    @track openMenuUserId = null;
    @track selectedTeamStatus = 'All';

    get hasUsers() { return this.users && this.users.length > 0; }

    handleTeamStatusChange(event) {
        this.selectedTeamStatus = event.target.value;
    }

    get processedUsers() {
        if (!this.users) return [];
        let filtered = [...this.users];
        
        if (this.selectedTeamStatus === 'Active') {
            filtered = filtered.filter(u => u.isActive);
        } else if (this.selectedTeamStatus === 'Not Active') {
            filtered = filtered.filter(u => !u.isActive);
        }

        return filtered.map((u, idx) => {
            const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const status = u.status || 'Inactive';
            return {
                ...u,
                avatarStyle:     `background-color:${color};`,
                roleBadgeClass:  this._roleBadge(u.role),
                statusDotClass:  u.isActive ? 'status-dot dot-active' : 'status-dot dot-inactive',
                statusLabel:     u.isActive ? 'Active' : 'Not Active',
                lastActiveLabel: this._timeAgo(u.lastLogin),
                menuOpen:        this.openMenuUserId === u.id
            };
        });
    }

    _roleBadge(role) {
        if (role === 'Admin')   return 'role-badge badge-admin';
        if (role === 'Manager') return 'role-badge badge-manager';
        return 'role-badge badge-user';
    }

    _timeAgo(dateStr) {
        if (!dateStr) return 'Never';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)    return 'Just now';
        if (mins < 60)   return `${mins} minute${mins > 1 ? 's' : ''} ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs  < 24)   return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
        const days = Math.floor(hrs / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    async loadTeamData() {
        try {
            const data = await getTeamData();
            this.totalSeats     = data.totalSeats     || 0;
            this.usedSeats      = data.usedSeats      || 0;
            this.availableSeats = data.availableSeats || 0;
            this.users          = data.users          || [];
            this._teamLoaded    = true;
        } catch (e) {
            console.error('Failed to load team data:', e);
        }
    }

    handleUserMenuToggle(event) {
        const uid = event.currentTarget.dataset.userid;
        this.openMenuUserId = (this.openMenuUserId === uid) ? null : uid;
    }

    async handleStatusUpdate(event) {
        const uid = event.currentTarget.dataset.userid;
        const isActive = event.currentTarget.dataset.status === 'true';
        this.openMenuUserId = null;
        try {
            await toggleUserStatus({ userId: uid, isActive: isActive });
            this.users = this.users.map(u => u.id === uid ? { ...u, isActive } : u);
            
            // Recalculate seats
            const countActive = this.users.filter(u => u.isActive).length;
            this.usedSeats = countActive;
            this.availableSeats = this.totalSeats - this.usedSeats;
        } catch(e) { console.error(e); }
    }

    async handleRoleChange(event) {
        const uid  = event.currentTarget.dataset.userid;
        const role = event.currentTarget.dataset.role;
        this.openMenuUserId = null;
        try {
            await updateUserRole({ userId: uid, newRole: role });
            this.users = this.users.map(u => u.id === uid ? { ...u, role } : u);
        } catch(e) { console.error(e); }
    }

    async handleDeactivateUser(event) {
        const uid = event.currentTarget.dataset.userid;
        this.openMenuUserId = null;
        // eslint-disable-next-line no-alert
        if (!confirm('Are you sure you want to remove this user?')) return;
        try {
            await toggleUserStatus({ userId: uid, isActive: false });
            this.users = this.users.filter(u => u.id !== uid);
            this.usedSeats      = Math.max(0, this.usedSeats - 1);
            this.availableSeats = this.totalSeats - this.usedSeats;
        } catch (e) { console.error(e); }
    }

    handleSelectAll() { /* bulk select UI — extend as needed */ }

    // ── Add Team Member Drawer ───────────────────────────────────
    @track showAddMemberDrawer = false;
    @track newUser = { firstName: '', lastName: '', email: '', username: '', role: 'User' };
    @track isCreating   = false;
    @track createError  = null;
    @track createSuccess = false;

    get isRoleUser()    { return this.newUser.role === 'User'; }
    get isRoleManager() { return this.newUser.role === 'Manager'; }
    get isRoleAdmin()   { return this.newUser.role === 'Admin'; }

    get roleOptionClass_User()    { return `role-option${this.newUser.role === 'User'    ? ' selected' : ''}`; }
    get roleOptionClass_Manager() { return `role-option${this.newUser.role === 'Manager' ? ' selected' : ''}`; }
    get roleOptionClass_Admin()   { return `role-option${this.newUser.role === 'Admin'   ? ' selected' : ''}`; }

    handleAddMember() {
        this.newUser       = { firstName: '', lastName: '', email: '', username: '', role: 'User' };
        this.createError   = null;
        this.createSuccess = false;
        this.showAddMemberDrawer = true;
    }

    handleCloseDrawer() { this.showAddMemberDrawer = false; }
    handleOverlayClick() { this.showAddMemberDrawer = false; }

    handleNewUserField(event) {
        const field = event.currentTarget.dataset.field;
        this.newUser = { ...this.newUser, [field]: event.target.value };
    }

    handleNewUserEmail(event) {
        const email = event.target.value;
        // Auto-populate username from email if not manually edited
        const uname = this.newUser.username === '' || this.newUser.username === this.newUser.email
            ? email : this.newUser.username;
        this.newUser = { ...this.newUser, email, username: uname };
    }

    handleRoleSelect(event) {
        this.newUser = { ...this.newUser, role: event.target.value };
    }

    async handleCreateUser() {
        this.createError   = null;
        this.createSuccess = false;

        const { firstName, lastName, email, username, role } = this.newUser;
        if (!firstName || !lastName || !email) {
            this.createError = 'First Name, Last Name, and Email are required.';
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.createError = 'Please enter a valid email address.';
            return;
        }
        const finalUsername = username || email;
        if (!emailRegex.test(finalUsername)) {
            this.createError = 'Username must be in email format.';
            return;
        }

        this.isCreating = true;
        try {
            const newId = await createTeamMember({
                firstName, lastName, email,
                username: finalUsername,
                cpqRole: role
            });
            this.createSuccess = true;
            // Add to local list
            this.users = [{
                id: newId, name: `${firstName} ${lastName}`,
                firstName, lastName, email,
                username: finalUsername, role,
                isActive: true, lastLogin: null,
                initials: (firstName[0] + lastName[0]).toUpperCase()
            }, ...this.users];
            this.usedSeats      = this.usedSeats + 1;
            this.availableSeats = Math.max(0, this.totalSeats - this.usedSeats);
            // Close drawer after 2 seconds
            setTimeout(() => { this.showAddMemberDrawer = false; }, 2000);
        } catch (e) {
            this.createError = e.body ? e.body.message : e.message;
        } finally {
            this.isCreating = false;
        }
    }
}
