module.exports = {
    apps : [{
        name: "socket-app",
        script: "./src/server.js",
        instances: "1",
        //exec_mode: "cluster",
        exec_mode: "fork",
        watch: true,
        max_memory_restart: "1G",
        env: {
            NODE_ENV: "production",
            PORT: 3000,
            REDIS_HOST: "localhost"
        },
        env_development: {
            NODE_ENV: "development"
        }
    }]
};