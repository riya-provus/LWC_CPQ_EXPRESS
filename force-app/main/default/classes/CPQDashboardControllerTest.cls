@isTest
public class CPQDashboardControllerTest {
    
    @testSetup
    static void setup() {
        Account acc = CPQTestDataFactory.createAccount('Dash Acc');
        Opportunity opp = CPQTestDataFactory.createOpportunity(acc.Id, 'Dash Opp');
        
        Quote q1 = CPQTestDataFactory.createQuote(opp.Id, 'Draft Q');
        q1.Status = 'Draft';
        q1.Margin_Percentage__c = 10;
        update q1;
        
        Quote q2 = CPQTestDataFactory.createQuote(opp.Id, 'Approved Q');
        q2.Status = 'Approved';
        q2.Margin_Percentage__c = 40;
        update q2;
    }

    @isTest
    static void testDashboardData() {
        Test.startTest();
        Map<String, Object> data = CPQDashboardController.getDashboardData();
        List<Quote> lowQuotes = CPQDashboardController.getQuotesByStatus('Draft');
        List<Quote> pendingQuotes = CPQDashboardController.getQuotesByStatus('Pending');
        List<Quote> all = CPQDashboardController.getAllQuotes();
        Test.stopTest();
        
        Assert.areNotEqual(null, data.get('userName'));
        Assert.areNotEqual(0, all.size());
    }
}
