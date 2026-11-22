package com.finsight.auth.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class ClientOriginTest {
    @Test
    void addsHttpsToRenderHostnameReferences() {
        assertEquals(
            "https://finsight-web.onrender.com",
            ClientOrigin.normalize("finsight-web.onrender.com")
        );
    }

    @Test
    void preservesLocalOriginsAndPorts() {
        assertEquals("http://localhost:3000", ClientOrigin.normalize("http://localhost:3000"));
    }

    @Test
    void rejectsPathsAndNonHttpSchemes() {
        assertThrows(IllegalArgumentException.class, () -> ClientOrigin.normalize("https://example.com/app"));
        assertThrows(IllegalArgumentException.class, () -> ClientOrigin.normalize("ftp://example.com"));
    }
}
