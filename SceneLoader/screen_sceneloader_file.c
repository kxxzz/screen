#include "screen_sceneloader_file.h"
#include "screen_a.h"

#include <fileu.h>
#include <vec.h>
#include <nxjson.h>







static u32 SCREEN_loadFileDataToBuf(vec_char* dataBuf, const char* filename, vec_char* pathBuf)
{
    u32 size = FILEU_readFile(filename, NULL, 0);
    if ((-1 == size) || !size)
    {
        // todo report error
        return -1;
    }
    u32 offset = dataBuf->length;
    vec_resize(dataBuf, offset + size + 1);
    size = FILEU_readFile(filename, dataBuf->data + offset, size);
    dataBuf->data[offset + size] = 0;

    if (pathBuf)
    {
        vec_pusharr(pathBuf, filename, 1 + (u32)strlen(filename));
    }
    return offset;
}







static void SCREEN_loadScenePassFromJson
(
    const nx_json* pass, const char* dir,
    SCREEN_Scene* desc, vec_char* dataBuf,
    u32* pOff, u32* pBi,
    vec_char* pathBuf
)
{
    char path[SCREEN_PATH_MAX] = "";
    if (pass->type != NX_JSON_OBJECT)
    {
        // todo report error
        goto error;
    }
    const nx_json* shader = nx_json_get(pass, "shader");
    if (shader->type != NX_JSON_STRING)
    {
        // todo report error
        goto error;
    }
    const char* filename = shader->text_value;
    snprintf(path, sizeof(path), "%s/%s", dir, filename);
    u32 off = SCREEN_loadFileDataToBuf(dataBuf, path, pathBuf);
    if (-1 == off)
    {
        // todo report error
        goto error;
    }

    u32 bi = -1;
    if (pBi)
    {
        const nx_json* id = nx_json_get(pass, "id");
        if (id->type != NX_JSON_INTEGER)
        {
            // todo report error
            goto error;
        }
        bi = (int)id->int_value;
        if (bi >= SCREEN_Channels_MAX)
        {
            // todo report error
            goto error;
        }
    }

    const nx_json* channels = nx_json_get(pass, "channels");
    if (channels->type != NX_JSON_NULL)
    {
        if (channels->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        if (channels->length > SCREEN_Channels_MAX)
        {
            // todo report error
            goto error;
        }
        for (int ci = 0; ci < channels->length; ++ci)
        {
            const nx_json* channel = nx_json_item(channels, ci);
            u32 cidx = ci;
            if ((channel->type != NX_JSON_ARRAY) && (channel->type != NX_JSON_NULL))
            {
                // todo report error
                goto error;
            }
            if (NX_JSON_NULL == channel->type)
            {
                continue;
            }
            if (channel->length != 2)
            {
                // todo report error
                goto error;
            }
            const nx_json* type = nx_json_item(channel, 0);
            if (type->type != NX_JSON_STRING)
            {
                // todo report error
                goto error;
            }
            const char* typeText = type->text_value;
            if (0 == strcicmp(typeText, "pass"))
            {
                if (pBi)
                {
                    desc->buffer[bi].channel[cidx].type = SCREEN_ChannelType_Buffer;
                }
                else
                {
                    desc->image.channel[cidx].type = SCREEN_ChannelType_Buffer;
                }

                const nx_json* bufferId = nx_json_item(channel, 1);
                if (bufferId->type != NX_JSON_INTEGER)
                {
                    // todo report error
                    goto error;
                }
                u32 id = (u32)bufferId->int_value;
                if (pBi)
                {
                    desc->buffer[bi].channel[cidx].buffer = id;
                }
                else
                {
                    desc->image.channel[cidx].buffer = id;
                }
            }
            else
            {
                // todo report error
                goto error;
            }
        }
    }
    *pOff = off;
    if (pBi)
    {
        *pBi = bi;
    }
    return;
error:
    *pOff = -1;
    *pBi = -1;
}







static SCREEN_LoadFileError SCREEN_loadSceneFromJson(char* code, const char* dir, SCREEN_Scene* desc, vec_char* pathBuf)
{
    vec_char dataBuf[1] = { 0 };
    char path[SCREEN_PATH_MAX] = "";
    u32 commShaderOff = -1, imageShaderOff = -1;
    bool bufferUsed[SCREEN_Buffers_MAX] = { 0 };
    u32 bufferShaderOff[SCREEN_Buffers_MAX] = { 0 };

    const nx_json* root = nx_json_parse(code, NULL);
    if (!root)
    {
        // todo report error
        return SCREEN_LoadFileError_FileInvalid;
    }
    {
        const nx_json* shader = nx_json_get(root, "commonShader");
        if (shader->type != NX_JSON_NULL)
        {
            if (shader->type != NX_JSON_STRING)
            {
                // todo report error
                goto error;
            }
            const char* filename = shader->text_value;
            snprintf(path, sizeof(path), "%s/%s", dir, filename);
            u32 off = SCREEN_loadFileDataToBuf(dataBuf, path, pathBuf);
            if (-1 == off)
            {
                // todo report error
                goto error;
            }
            commShaderOff = off;
        }
    }
    const nx_json* buffers = nx_json_get(root, "buffers");
    if (buffers->type != NX_JSON_NULL)
    {
        if (buffers->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        for (int i = 0; i < buffers->length; ++i)
        {
            const nx_json* buffer = nx_json_item(buffers, i);
            u32 off, bi;
            SCREEN_loadScenePassFromJson(buffer, dir, desc, dataBuf, &off, &bi, pathBuf);
            if (off != -1)
            {
                assert(bi != -1);
                bufferShaderOff[bi] = off;
                bufferUsed[bi] = true;
            }
        }
    }

    const nx_json* image = nx_json_get(root, "image");
    SCREEN_loadScenePassFromJson(image, dir, desc, dataBuf, &imageShaderOff, NULL, pathBuf);

    if (commShaderOff != -1)
    {
        desc->shaderComm = dataBuf->data + commShaderOff;
    }
    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        if (bufferUsed[i])
        {
            desc->buffer[i].shaderCode = dataBuf->data + bufferShaderOff[i];
        }
    }
    desc->image.shaderCode = dataBuf->data + imageShaderOff;

    SCREEN_loadScene(desc);

    vec_free(dataBuf);
    nx_json_free(root);
    return SCREEN_LoadFileError_NONE;
error:
    vec_free(dataBuf);
    nx_json_free(root);
    return SCREEN_LoadFileError_FileInvalid;
}









SCREEN_LoadFileError SCREEN_loadSceneFile(const char* filename, vec_char* pathBuf)
{
    SCREEN_Scene desc[1] = { 0 };
    if (FILEU_fileExist(filename))
    {
        if (FILEU_dirExist(filename))
        {
            char path[SCREEN_PATH_MAX] = "";
            snprintf(path, sizeof(path), "%s/%s", filename, "index.json");

            if (FILEU_fileExist(path))
            {
                u32 size = FILEU_readFile(path, NULL, 0);
                if ((-1 == size) || !size)
                {
                    // todo report error
                    return SCREEN_LoadFileError_FileInvalid;
                }
                char* buf = malloc(size + 1);
                size = FILEU_readFile(path, buf, size);
                buf[size] = 0;

                if (pathBuf)
                {
                    vec_pusharr(pathBuf, path, 1 + (u32)strlen(path));
                }

                char dir[SCREEN_PATH_MAX];
                FILEU_getDirName(dir, path, sizeof(dir));
                SCREEN_LoadFileError r = SCREEN_loadSceneFromJson(buf, dir, desc, pathBuf);
                free(buf);
                return r;
            }
            else
            {
                // todo report error
                return SCREEN_LoadFileError_NoEntryFile;
            }
        }
        else
        {
            if ((0 == strcicmp(FILEU_filenameExt(filename), "frag")) ||
                (0 == strcicmp(FILEU_filenameExt(filename), "glsl")) ||
                (0 == strcicmp(FILEU_filenameExt(filename), "fs")) ||
                (0 == strcicmp(FILEU_filenameExt(filename), "fsh")) ||
                (0 == strcicmp(FILEU_filenameExt(filename), "fshader")))
            {
                u32 size = FILEU_readFile(filename, NULL, 0);
                if ((-1 == size) || !size)
                {
                    // todo report error
                    return SCREEN_LoadFileError_FileInvalid;
                }
                char* buf = malloc(size + 1);
                size = FILEU_readFile(filename, buf, size);
                buf[size] = 0;

                if (pathBuf)
                {
                    vec_pusharr(pathBuf, filename, 1 + (u32)strlen(filename));
                }

                desc->image.shaderCode = buf;
                bool r = SCREEN_loadScene(desc);
                free(buf);
                return r ? SCREEN_LoadFileError_NONE : SCREEN_LoadFileError_FileInvalid;
            }
            else if (0 == strcicmp(FILEU_filenameExt(filename), "json"))
            {
                u32 size = FILEU_readFile(filename, NULL, 0);
                if ((-1 == size) || !size)
                {
                    // todo report error
                    return SCREEN_LoadFileError_FileInvalid;
                }
                char* buf = malloc(size + 1);
                size = FILEU_readFile(filename, buf, size);
                buf[size] = 0;

                if (pathBuf)
                {
                    vec_pusharr(pathBuf, filename, 1 + (u32)strlen(filename));
                }

                char dir[SCREEN_PATH_MAX];
                FILEU_getDirName(dir, filename, sizeof(dir));
                SCREEN_LoadFileError r = SCREEN_loadSceneFromJson(buf, dir, desc, pathBuf);
                free(buf);
                return r;
            }
            else
            {
                // todo report error
                return SCREEN_LoadFileError_FileUnkExt;
            }
        }
    }
    else
    {
        // todo report error
        return SCREEN_LoadFileError_NoFile;
    }
}































































































