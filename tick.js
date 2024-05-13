function tick(players, inputsMap, GRAVITY, JUMPSPEED) {
    for (let player of players) {
        const inputs = inputsMap[player.id];

        // Apply gravity
        if (player.y < 330) {
            player.velocity.y += GRAVITY;
        }

        // Update position
        player.y += player.velocity.y;

        // Clamp the player to the ground level
        if (player.y > 330) {
            player.y = 330;
            if (player.velocity.y > 0) {
                player.velocity.y = 0;
            }
        }
        // Check if the player is initiating a jump
        if (inputs.up && player.velocity.y === 0 && player.y === 330) {
            player.velocity.y = JUMPSPEED;
        }

        // Horizontal movement
        if (inputs.left) {
            if(player.x > 0){
                player.x -= 8;
            }
        } else if (inputs.right) {
            if(player.x < 950){
                player.x += 8;
            }
        }
    }
}

export default tick