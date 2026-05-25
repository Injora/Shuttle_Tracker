const prisma = require('./src/lib/prisma');
const stateMachine = require('./src/services/stateMachine');

(async () => {
    const shift1 = await prisma.shift.findFirst({
        where: { state: stateMachine.STATES.IDLE, endedAt: { isSet: false } }
    });
    console.log("With isSet: false ->", shift1 != null);
    
    process.exit(0);
})();
