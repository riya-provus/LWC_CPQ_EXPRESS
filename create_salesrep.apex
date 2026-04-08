Profile p = [SELECT Id FROM Profile WHERE Name = 'Custom Sales Rep Profile' LIMIT 1];
String uniqueUser = 'salesrep_cpqexpress_' + Datetime.now().getTime() + '@example.com';
User u = new User(
    Alias = 'srep',
    Email = 'salesrep_cpq@example.com',
    EmailEncodingKey = 'UTF-8',
    LastName = 'SalesRep',
    LanguageLocaleKey = 'en_US',
    LocaleSidKey = 'en_US',
    TimeZoneSidKey = 'America/Los_Angeles',
    ProfileId = p.Id,
    UserName = uniqueUser
);
insert u;
System.debug('User created successfully with Id: ' + u.Id + ' and Username: ' + u.UserName);
