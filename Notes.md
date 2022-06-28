
Events in solidity are used to inform/log information from the smart contract execution. 
Events are implemented at a very lower level and it is not possible for other contracts (executing in the same env) to look up each other's events
Front ends, on the other hand, are perfectly able to subscribes to events using libraries like web3. 
Events may have 4 topics and 1 data field. Topics are indexed params (more on this later). Indexed params are not logged by solidity instead they are used to fileter events data field. 
EVM by default uses the first topic param to store the Event's signature. This leaves with 3 indexed params and 1 data field.
    Event can have up to 3 indexed params and 1 data field (no limit on data fields)
    
Why are indexed params important? 
Indexed params are important because they help us to filter data emitted by the events. Suppose there is a contract that provide multi game supports. 
In this contract, there is a play method which logs an event based on the current selection made by the user.
Indexed params make it easy to have a single event declaration instead of having one for each game.
