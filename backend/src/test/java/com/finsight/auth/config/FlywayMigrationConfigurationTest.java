package com.finsight.auth.config;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.flywaydb.core.api.MigrationState;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;

class FlywayMigrationConfigurationTest {
    private final FlywayMigrationStrategy strategy =
        new FlywayMigrationConfiguration().flywayMigrationStrategy();

    @Test
    void repairsFailedVersionSixBeforeMigrating() {
        Flyway flyway = mock(Flyway.class);
        MigrationInfo migration = migration("6", MigrationState.FAILED);
        MigrationInfoService info = migrationInfo(migration);
        when(flyway.info()).thenReturn(info);

        strategy.migrate(flyway);

        InOrder order = inOrder(flyway);
        order.verify(flyway).repair();
        order.verify(flyway).migrate();
    }

    @Test
    void repairsVersionSixWhenAppliedChecksumDiffers() {
        Flyway flyway = mock(Flyway.class);
        MigrationInfo migration = migration("6", MigrationState.SUCCESS);
        when(migration.isApplied()).thenReturn(true);
        when(migration.isChecksumMatching()).thenReturn(false);
        MigrationInfoService info = migrationInfo(migration);
        when(flyway.info()).thenReturn(info);

        strategy.migrate(flyway);

        InOrder order = inOrder(flyway);
        order.verify(flyway).repair();
        order.verify(flyway).migrate();
    }

    @Test
    void doesNotRepairUnrelatedFailedMigrations() {
        Flyway flyway = mock(Flyway.class);
        MigrationInfoService info = migrationInfo(
            migration("5", MigrationState.FAILED),
            migration("6", MigrationState.FAILED)
        );
        when(flyway.info()).thenReturn(info);

        strategy.migrate(flyway);

        verify(flyway, never()).repair();
        verify(flyway).migrate();
    }

    private static MigrationInfoService migrationInfo(MigrationInfo... migrations) {
        MigrationInfoService info = mock(MigrationInfoService.class);
        when(info.all()).thenReturn(migrations);
        return info;
    }

    private static MigrationInfo migration(String version, MigrationState state) {
        MigrationInfo migration = mock(MigrationInfo.class);
        when(migration.getVersion()).thenReturn(MigrationVersion.fromVersion(version));
        when(migration.getState()).thenReturn(state);
        return migration;
    }
}
