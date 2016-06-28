# Slow, not stupid
A game about being followed

## API Endpoints
All endpoints receive data as a JSON Post. All endpoints require the following
keys:
* `token` Google OAuth token

### Post `/location`
Posts the user's current location and receives information
about It.
* `lat` Latitude
* `lon` Longitude

Result attributes are as follows
* `nearby` String of name nearby
* `killed` Int showing how many times the player was killed since their last post

### Post `/create`
Creates an It whose first target is the user who submits the post.

### Post `/infect`
Infects the posting user with It, if the user represented with the id
is currently at the head of an It. The two users must be within 5 meters
of each other.
* `id` Id of user to take infection from

## Running
### environment variables
Make sure you have the following environment variables:
* `APP_CLIENT_ID` Id of client app
* `DATABASE_URL` Postgres connection string
