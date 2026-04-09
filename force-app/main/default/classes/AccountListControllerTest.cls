@isTest
public class AccountListControllerTest {
    
    @testSetup
    static void setup() {
        CPQTestDataFactory.createAccount('Test Alpha');
    }

    @isTest
    static void testGetAccounts() {
        Test.startTest();
        List<Account> all = AccountListController.getAccountsDetailed();
        Test.stopTest();
        Assert.areNotEqual(0, all.size());
    }

    @isTest
    static void testGetFilterOptions() {
        Test.startTest();
        Map<String, List<String>> options = AccountListController.getAccountFilters();
        Test.stopTest();
        Assert.isTrue(options.containsKey('Type'));
    }

    @isTest
    static void testUpsertAccount() {
        Test.startTest();
        AccountListController.createAccount('New Acc', 'Customer', 'Technology', '123', 'www.test.com');
        
        Account existing = [SELECT Id, Name FROM Account WHERE Name = 'Test Alpha' LIMIT 1];
        AccountListController.updateAccount(existing.Id, 'Test Alpha Updated', 'Customer', 'Technology', '123', 'www.test.com');
        Test.stopTest();
        
        Assert.areEqual(2, [SELECT COUNT() FROM Account]);
        Account check = [SELECT Name FROM Account WHERE Id = :existing.Id];
        Assert.areEqual('Test Alpha Updated', check.Name);
    }

    @isTest
    static void testDeleteAccount() {
        Account existing = [SELECT Id FROM Account LIMIT 1];
        Test.startTest();
        AccountListController.deleteAccount(existing.Id);
        Test.stopTest();
        Assert.areEqual(0, [SELECT COUNT() FROM Account]);
    }
}
