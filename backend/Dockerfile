FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY maven-settings.xml /root/.m2/settings.xml
COPY pom.xml .
COPY src ./src
COPY database ./database

RUN mvn -B -s /root/.m2/settings.xml clean package -DskipTests

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

ENV PORT=10000
EXPOSE 10000

ENTRYPOINT ["java", "-jar", "app.jar"]