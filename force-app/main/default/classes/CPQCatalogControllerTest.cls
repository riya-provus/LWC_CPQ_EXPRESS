@isTest
public class CPQCatalogControllerTest {
    
    @testSetup
    static void setup() {
        CPQTestDataFactory.createProduct('Prod', 100, 50);
        CPQTestDataFactory.createAddon('Addon', 50, 20);
        CPQTestDataFactory.createRole('Role', 150);
    }

    @isTest
    static void testProductController() {
        Test.startTest();
        List<CPQ_Product__c> all = ProductListController.getProducts();
        // Use 'Each' as it is a restricted picklist value
        CPQ_Product__c created = ProductListController.createProduct('New', 'Desc', 'Each', 10, 5, 'Tag', true, 'NY', 'NY', 'US', 'Loc');
        ProductListController.updateProduct(created.Id, 'Upd', 'Desc', 'Each', 10, 5, 'Tag', true, 'NY', 'NY', 'US', 'Loc');
        ProductListController.toggleProductActive(created.Id, false);
        ProductListController.deleteProduct(created.Id);
        Test.stopTest();
        Assert.areNotEqual(0, all.size());
    }

    @isTest
    static void testAddonController() {
        Test.startTest();
        List<CPQ_Addon__c> all = AddonListController.getAddons();
        // Use 'Each' as it is a restricted picklist value
        CPQ_Addon__c created = AddonListController.createAddon('New', 'Desc', 'Each', 10, 5, 'Tag', true, 'NY', 'NY', 'US', 'Loc');
        AddonListController.updateAddon(created.Id, 'Upd', 'Desc', 'Each', 10, 5, 'Tag', true, 'NY', 'NY', 'US', 'Loc');
        AddonListController.toggleAddonActive(created.Id, false);
        AddonListController.deleteAddon(created.Id);
        Test.stopTest();
        Assert.areNotEqual(0, all.size());
    }

    @isTest
    static void testResourceRoleController() {
        Test.startTest();
        List<Resource_Role__c> all = ResourceRoleController.getResourceRoles();
        Resource_Role__c created = ResourceRoleController.createResourceRole('New', 'Desc', 100, 50, 'Hour', 'NY', 'NY', 'US', true);
        ResourceRoleController.updateResourceRole(created.Id, 'Upd', 'Desc', 110, 55, 'Hour', 'NY', 'NY', 'US', true);
        ResourceRoleController.toggleResourceRoleActive(created.Id, false);
        ResourceRoleController.deleteResourceRole(created.Id);
        Test.stopTest();
        Assert.areNotEqual(0, all.size());
    }
}
