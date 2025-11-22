
// The Algorithm
function runMatching(participants) {
    const hosts = participants.filter((p) => p.assigned_role === "host");
    const guests = participants.filter((p) => p.assigned_role === "guest");

    console.log(`\n--- Running Matching ---`);
    console.log(`Hosts: ${hosts.length}, Guests: ${guests.length}`);

    // Shuffle (mock shuffle)
    const shuffledHosts = [...hosts];
    const shuffledGuests = [...guests];

    // Calculate total capacity
    const totalCapacity = shuffledHosts.reduce((sum, host) => sum + (host.host_max_guests || 5), 0);

    // Calculate total guest count (including plus ones)
    const totalGuestCount = shuffledGuests.reduce((sum, guest) => sum + (guest.has_plus_one ? 2 : 1), 0);

    console.log(`Total Host Capacity: ${totalCapacity}, Total Guests (with +1s): ${totalGuestCount}`);

    if (totalCapacity < totalGuestCount) {
        console.warn("Warning: Not enough host capacity for all guests!");
    }

    const unassignedGuests = [];

    // Initialize host tracking
    const hostStatus = shuffledHosts.map(host => ({
        ...host,
        currentGuests: 0,
        maxGuests: host.host_max_guests || 5,
        assignedGuests: []
    }));

    let guestsAssignedCount = 0;

    for (const guest of shuffledGuests) {
        const guestSize = guest.has_plus_one ? 2 : 1;
        let assigned = false;

        // Find a host with space
        // We sort hosts by % full to distribute evenly
        hostStatus.sort((a, b) => (a.currentGuests / a.maxGuests) - (b.currentGuests / b.maxGuests));

        for (const host of hostStatus) {
            if (host.currentGuests + guestSize <= host.maxGuests) {
                host.assignedGuests.push(guest);
                host.currentGuests += guestSize;
                assigned = true;
                guestsAssignedCount += guestSize;
                break;
            }
        }

        if (!assigned) {
            unassignedGuests.push(guest);
        }
    }

    console.log(`Assigned ${guestsAssignedCount} guest units. Unassigned: ${unassignedGuests.length} guest units.`);

    // Print results
    hostStatus.forEach(h => {
        console.log(`Host ${h.id} (Cap: ${h.maxGuests}): ${h.currentGuests} guests (${h.assignedGuests.length} units)`);
    });

    if (unassignedGuests.length > 0) {
        console.log(`Unassigned Guests: ${unassignedGuests.map(g => g.id + (g.has_plus_one ? ' (+1)' : '')).join(', ')}`);
    }

    return { hostStatus, unassignedGuests };
}

// Scenarios

// Scenario 1: Sufficient Capacity
console.log("\n=== Scenario 1: Sufficient Capacity ===");
const scenario1 = [
    { id: 'H1', assigned_role: 'host', has_plus_one: false, host_max_guests: 5 },
    { id: 'H2', assigned_role: 'host', has_plus_one: false, host_max_guests: 3 },
    { id: 'G1', assigned_role: 'guest', has_plus_one: true }, // 2
    { id: 'G2', assigned_role: 'guest', has_plus_one: false }, // 1
    { id: 'G3', assigned_role: 'guest', has_plus_one: true }, // 2
    { id: 'G4', assigned_role: 'guest', has_plus_one: false }, // 1
    // Total guests: 6. Total Cap: 8.
];
runMatching(scenario1);

// Scenario 2: Insufficient Capacity
console.log("\n=== Scenario 2: Insufficient Capacity ===");
const scenario2 = [
    { id: 'H1', assigned_role: 'host', has_plus_one: false, host_max_guests: 3 },
    { id: 'G1', assigned_role: 'guest', has_plus_one: true }, // 2
    { id: 'G2', assigned_role: 'guest', has_plus_one: true }, // 2
    // Total guests: 4. Total Cap: 3.
];
runMatching(scenario2);

// Scenario 3: Exact Capacity
console.log("\n=== Scenario 3: Exact Capacity ===");
const scenario3 = [
    { id: 'H1', assigned_role: 'host', has_plus_one: false, host_max_guests: 4 },
    { id: 'G1', assigned_role: 'guest', has_plus_one: true }, // 2
    { id: 'G2', assigned_role: 'guest', has_plus_one: true }, // 2
    // Total guests: 4. Total Cap: 4.
];
runMatching(scenario3);
