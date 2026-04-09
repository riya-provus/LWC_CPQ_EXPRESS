@isTest
public class QuotesListControllerTest {
    
    @testSetup
    static void setup() {
        Account acc = CPQTestDataFactory.createAccount('Test Account');
        Opportunity opp = CPQTestDataFactory.createOpportunity(acc.Id, 'Test Opp');
        CPQTestDataFactory.createQuote(opp.Id, 'Quote 1');
    }

    @isTest
    static void testGetQuotes() {
        Test.startTest();
        List<Quote> quotes = QuotesListController.getAllQuotes();
        Test.stopTest();
        Assert.areNotEqual(0, quotes.size());
    }

    @isTest
    static void testGetLookups() {
        Test.startTest();
        List<Account> accs = QuotesListController.getAccounts();
        List<Opportunity> opps = QuotesListController.getOpportunities();
        Test.stopTest();
        Assert.areNotEqual(0, accs.size());
        Assert.areNotEqual(0, opps.size());
    }

    @isTest
    static void testCreateQuote() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];
        Test.startTest();
        // Test standard create
        String q1 = QuotesListController.createQuote(opp.Id, acc.Id, 'Desc', '2023-01-01', '2023-12-31', '12');
        // Test auto-opportunity creation pathway
        String q2 = QuotesListController.createQuote(null, acc.Id, 'Desc', '', '2023-12-31', '');
        Test.stopTest();
        Assert.areNotEqual(null, q1);
        Assert.areNotEqual(null, q2);
    }

    @isTest
    static void testCloneQuote() {
        Quote q = [SELECT Id FROM Quote LIMIT 1];
        Test.startTest();
        QuotesListController.cloneQuote(q.Id);
        Test.stopTest();
        Assert.areEqual(2, [SELECT COUNT() FROM Quote]);
    }

    @isTest
    static void testDeleteQuote() {
        Quote q = [SELECT Id FROM Quote LIMIT 1];
        Test.startTest();
        QuotesListController.deleteQuote(q.Id);
        Test.stopTest();
        Assert.areEqual(0, [SELECT COUNT() FROM Quote]);
    }
}
