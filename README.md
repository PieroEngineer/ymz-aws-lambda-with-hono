
DynamoDB Query Range Reference

+ An Entire Month
	+ Set :from to: ORDER#2026-10
	+ Set :to to: ORDER#2026-10\uFFFF
	+ Matches: All orders in October 2026
+ A Specific Day
	+ Set :from to: ORDER#2026-10-08
	+ Set :to to: ORDER#2026-10-08\uFFFF
	+ Matches: Every item/order created on October 8, 2026
+ Down to the Minute
	+ Set :from to: ORDER#2026-10-08T14:30
	+ Set :to to: ORDER#2026-10-08T14:30\uFFFF
	+ Matches: Orders in that exact minute