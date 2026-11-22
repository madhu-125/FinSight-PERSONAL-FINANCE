package com.finsight.auth.config;

import java.util.Arrays;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationState;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayMigrationConfiguration {
    private static final String FAILED_TIDB_MIGRATION_VERSION = "6";

    @Bean
    FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            MigrationInfo[] migrations = flyway.info().all();
            boolean versionSixNeedsRepair = Arrays.stream(migrations)
                .anyMatch(migration -> isVersionSix(migration)
                    && (migration.getState() == MigrationState.FAILED
                        || migration.getState() == MigrationState.OUTDATED
                        || (migration.isApplied() && !migration.isChecksumMatching())));
            boolean otherMigrationNeedsRepair = Arrays.stream(migrations)
                .anyMatch(migration -> !isVersionSix(migration)
                    && (migration.getState() == MigrationState.FAILED
                        || migration.getState() == MigrationState.OUTDATED));

            if (versionSixNeedsRepair && !otherMigrationNeedsRepair) {
                flyway.repair();
            }
            flyway.migrate();
        };
    }

    private static boolean isVersionSix(MigrationInfo migration) {
        return migration.getVersion() != null
            && FAILED_TIDB_MIGRATION_VERSION.equals(migration.getVersion().toString());
    }
}
