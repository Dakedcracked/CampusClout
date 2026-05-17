import asyncio
import httpx

async def test_api():
    async with httpx.AsyncClient() as client:
        # We need a valid token. Let's register a new user to get one.
        res = await client.post(
            "http://localhost:8000/api/v1/auth/register",
            json={
                "email": "test_post@stanford.edu",
                "username": "test_post_user",
                "password": "Password123!",
                "display_name": "Test Post"
            }
        )
        print("Register:", res.status_code, res.text)
        
        # Login
        res = await client.post(
            "http://localhost:8000/api/v1/auth/login",
            json={
                "email": "test_post@stanford.edu",
                "password": "Password123!"
            }
        )
        print("Login:", res.status_code, res.text)
        token = res.cookies.get("access_token")
        
        # Post
        res = await client.post(
            "http://localhost:8000/api/v1/feed",
            json={
                "content": "Hello world this is a test post",
                "post_as_alter_ego": False
            },
            cookies={"access_token": token}
        )
        print("Create Post:", res.status_code, res.text)
        
        # Get Feed
        res = await client.get(
            "http://localhost:8000/api/v1/feed",
            cookies={"access_token": token}
        )
        print("Get Feed:", res.status_code, len(res.json()))
        
        # Get Me
        res = await client.get(
            "http://localhost:8000/api/v1/auth/me",
            cookies={"access_token": token}
        )
        print("Get Me:", res.status_code, res.text)

if __name__ == "__main__":
    asyncio.run(test_api())
