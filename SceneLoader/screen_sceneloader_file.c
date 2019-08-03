#include "screen_sceneloader_file.h"
#include "screen_a.h"

#include <fileu.h>
#include <vec.h>
#include <nxjson.h>

#include <stb_image.h>





static void SCREEN_pathAdd(const char* filename, vec_char* pathBuf)
{
    if (pathBuf)
    {
        vec_pusharr(pathBuf, filename, 1 + (u32)strlen(filename));
    }
}



static u32 SCREEN_loadFileDataToBuf(vec_char* dataBuf, vec_char* pathBuf, const char* filename, bool addStrEnd)
{
    u32 size = FILEU_readFile(filename, NULL, 0);
    if ((-1 == size) || !size)
    {
        // todo report error
        return -1;
    }
    u32 offset = dataBuf->length;
    vec_resize(dataBuf, offset + size + (addStrEnd ? 1 : 0));
    size = FILEU_readFile(filename, dataBuf->data + offset, size);
    if (addStrEnd)
    {
        dataBuf->data[offset + size] = 0;
    }
    SCREEN_pathAdd(filename, pathBuf);
    return offset;
}







static bool SCREEN_loadAssetFromImageFile
(
    vec_char* dataBuf, vec_char* pathBuf, SCREEN_Asset* asset, const char* filename
)
{
    int x, y, comp;
    int r = stbi_info(filename, &x, &y, &comp);
    if (!r)
    {
        // todo report error
        return false;
    }
    if ((comp != 1) && (comp != 3) && (comp != 4))
    {
        // todo report error
        return false;
    }
    if (asset)
    {
        asset->components = comp;
        asset->size[0] = x;
        asset->size[1] = y;
        asset->size[2] = 1;
    }
    SCREEN_loadFileDataToBuf(dataBuf, pathBuf, filename, false);
    return true;
}









static void SCREEN_loadSceneAssetFromJson
(
    const nx_json* assetJs, const char* dir,
    SCREEN_Asset* desc, vec_char* dataBuf, u32* pDataOff, vec_char* pathBuf
)
{
    char path[SCREEN_PATH_BUF_MAX] = "";
    if (assetJs->type != NX_JSON_OBJECT)
    {
        // todo report error
        goto error;
    }

    SCREEN_AssetType type = -1;
    {
        const nx_json* typeJs = nx_json_get(assetJs, "type");
        if (NX_JSON_NULL == typeJs->type)
        {
            type = SCREEN_AssetType_2D;
        }
        else
        {
            if (typeJs->type != NX_JSON_STRING)
            {
                // todo report error
                goto error;
            }
            const char* typeStr = typeJs->text_value;
            for (u32 i = 0; i < SCREEN_AssetTypeCount; ++i)
            {
                if (strcicmp(typeStr, SCREEN_AssetTypeNameTable(i)) == 0)
                {
                    desc->type = i;
                    type = i;
                    break;
                }
            }
            if (-1 == type)
            {
                // todo report error
                goto error;
            }
        }
    }

    if (SCREEN_AssetType_2D == type)
    {
        const nx_json* uriJs = nx_json_get(assetJs, "uri");
        if (uriJs->type != NX_JSON_STRING)
        {
            // todo report error
            goto error;
        }
        const char* filename = uriJs->text_value;
        snprintf(path, sizeof(path), "%s/%s", dir, filename);

        u32 dataOff = dataBuf->length;
        if (!SCREEN_loadAssetFromImageFile(dataBuf, pathBuf, desc, path))
        {
            goto error;
        }
        desc->dataSize = dataBuf->length - dataOff;
        *pDataOff = dataOff;
    }
    else if (SCREEN_AssetType_Cube == type)
    {
        const nx_json* facesJs = nx_json_get(assetJs, "faces");
        if (facesJs->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        if (facesJs->length != 6)
        {
            // todo report error
            goto error;
        }

        u32 dataOff = dataBuf->length;
        for (u32 f = 0; f < 6; ++f)
        {
            const nx_json* faceJs = nx_json_item(facesJs, f);
            if (faceJs->type != NX_JSON_STRING)
            {
                // todo report error
                goto error;
            }
            const char* filename = faceJs->text_value;
            snprintf(path, sizeof(path), "%s/%s", dir, filename);

            u32 dataOff = dataBuf->length;
            if (!SCREEN_loadAssetFromImageFile(dataBuf, pathBuf, (0 == f) ? desc : NULL, path))
            {
                goto error;
            }
            desc->cubeFaceDataSize[f] = dataBuf->length - dataOff;
        }
        desc->dataSize = dataBuf->length - dataOff;
        *pDataOff = dataOff;
    }
    else
    {
        // todo report error
        goto error;
    }
    return;
error:
    *pDataOff = -1;
}









static void SCREEN_loadScenePassFromJson
(
    const nx_json* passJs, const char* dir,
    SCREEN_Scene* desc, vec_char* dataBuf, vec_char* pathBuf,
    u32* pShaderOff, u32* pBi
)
{
    char path[SCREEN_PATH_BUF_MAX] = "";
    if (passJs->type != NX_JSON_OBJECT)
    {
        // todo report error
        goto error;
    }
    const nx_json* shaderJs = nx_json_get(passJs, "shader");
    if (shaderJs->type != NX_JSON_STRING)
    {
        // todo report error
        goto error;
    }
    const char* filename = shaderJs->text_value;
    snprintf(path, sizeof(path), "%s/%s", dir, filename);
    u32 shaderOff = SCREEN_loadFileDataToBuf(dataBuf, pathBuf, path, true);
    if (-1 == shaderOff)
    {
        // todo report error
        goto error;
    }

    u32 bi = -1;
    if (pBi)
    {
        const nx_json* idJs = nx_json_get(passJs, "id");
        if (idJs->type != NX_JSON_INTEGER)
        {
            // todo report error
            goto error;
        }
        bi = (int)idJs->int_value;
        if (bi >= SCREEN_Channels_MAX)
        {
            // todo report error
            goto error;
        }
    }

    SCREEN_RenderPass* renderPass;
    if (pBi)
    {
        renderPass = desc->buffer + bi;
    }
    else
    {
        renderPass = desc->image;
    }

    const nx_json* channelsJs = nx_json_get(passJs, "channels");
    if (channelsJs->type != NX_JSON_NULL)
    {
        if (channelsJs->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        if (channelsJs->length > SCREEN_Channels_MAX)
        {
            // todo report error
            goto error;
        }
        for (int ci = 0; ci < channelsJs->length; ++ci)
        {
            const nx_json* channelJs = nx_json_item(channelsJs, ci);
            u32 cidx = ci;
            if ((channelJs->type != NX_JSON_ARRAY) && (channelJs->type != NX_JSON_NULL))
            {
                // todo report error
                goto error;
            }
            if (NX_JSON_NULL == channelJs->type)
            {
                continue;
            }
            if (!channelJs->length)
            {
                // todo report error
                goto error;
            }
            const nx_json* typeJs = nx_json_item(channelJs, 0);
            if (typeJs->type != NX_JSON_STRING)
            {
                // todo report error
                goto error;
            }
            const char* typeText = typeJs->text_value;
            if (0 == strcicmp(typeText, "buffer"))
            {
                renderPass->channel[cidx].type = SCREEN_ChannelType_Buffer;
                const nx_json* idJs = nx_json_item(channelJs, 1);
                if (idJs->type != NX_JSON_INTEGER)
                {
                    // todo report error
                    goto error;
                }
                renderPass->channel[cidx].buffer = (u32)idJs->int_value;
            }
            else if (0 == strcicmp(typeText, "keyboard"))
            {
                renderPass->channel[cidx].type = SCREEN_ChannelType_Keyboard;
            }
            else if (0 == strcicmp(typeText, "asset"))
            {
                renderPass->channel[cidx].type = SCREEN_ChannelType_Asset;
                const nx_json* idJs = nx_json_item(channelJs, 1);
                if (idJs->type != NX_JSON_INTEGER)
                {
                    // todo report error
                    goto error;
                }
                renderPass->channel[cidx].buffer = (u32)idJs->int_value;
            }
            else
            {
                // todo report error
                goto error;
            }

            switch (renderPass->channel[cidx].type)
            {
            case SCREEN_ChannelType_Buffer:
            {
                renderPass->channel[cidx].filter = SCREEN_ChannelFilter_Linear;
                renderPass->channel[cidx].wrap = SCREEN_ChannelWrap_Clamp;
                break;
            }
            case SCREEN_ChannelType_Keyboard:
            {
                renderPass->channel[cidx].filter = SCREEN_ChannelFilter_Linear;
                renderPass->channel[cidx].wrap = SCREEN_ChannelWrap_Clamp;
                break;
            }
            case SCREEN_ChannelType_Asset:
            {
                renderPass->channel[cidx].filter = SCREEN_ChannelFilter_Mipmap;
                renderPass->channel[cidx].wrap = SCREEN_ChannelWrap_Repeat;
                break;
            }
            default:
                assert(false);
                break;
            }

            const nx_json* lastJs = nx_json_item(channelJs, channelJs->length - 1);
            if (lastJs->type == NX_JSON_OBJECT)
            {
                const nx_json* wrapJs = nx_json_get(lastJs, "wrap");
                const nx_json* filterJs = nx_json_get(lastJs, "filter");
                if (wrapJs->type != NX_JSON_NULL)
                {
                    if (wrapJs->type != NX_JSON_STRING)
                    {
                        // todo report error
                        goto error;
                    }
                    static const char* nameTable[SCREEN_ChannelWrapCount] =
                    {
                        "repeat",
                        "clamp",
                    };
                    bool m = false;
                    for (u32 i = 0; i < SCREEN_ChannelWrapCount; ++i)
                    {
                        if (0 == strcicmp(nameTable[i], wrapJs->text_value))
                        {
                            renderPass->channel[cidx].wrap = i;
                            m = true;
                            break;
                        }
                    }
                    if (!m)
                    {
                        // todo report error
                        goto error;
                    }
                }
                if (filterJs->type != NX_JSON_NULL)
                {
                    if (filterJs->type != NX_JSON_STRING)
                    {
                        // todo report error
                        goto error;
                    }
                    static const char* nameTable[SCREEN_ChannelFilterCount] =
                    {
                        "mipmap",
                        "linear",
                        "nearest",
                    };
                    bool m = false;
                    for (u32 i = 0; i < SCREEN_ChannelFilterCount; ++i)
                    {
                        if (0 == strcicmp(nameTable[i], filterJs->text_value))
                        {
                            renderPass->channel[cidx].filter = i;
                            m = true;
                            break;
                        }
                    }
                    if (!m)
                    {
                        // todo report error
                        goto error;
                    }
                }
            }
            // lastJs
        }
    }

    const nx_json* specBufferSizeJs = nx_json_get(passJs, "specBufferSize");
    if (specBufferSizeJs->type != NX_JSON_NULL)
    {
        if (specBufferSizeJs->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        if (specBufferSizeJs->length != 2)
        {
            // todo report error
            goto error;
        }
        renderPass->isSpecBufferSize = true;
        const nx_json* widthJs = nx_json_item(specBufferSizeJs, 0);
        const nx_json* heightJs = nx_json_item(specBufferSizeJs, 1);
        if (widthJs->type != NX_JSON_INTEGER)
        {
            // todo report error
            goto error;
        }
        if (heightJs->type != NX_JSON_INTEGER)
        {
            // todo report error
            goto error;
        }
        renderPass->bufferWidth = (u32)widthJs->int_value;
        renderPass->bufferHeight = (u32)heightJs->int_value;
    }

    *pShaderOff = shaderOff;
    if (pBi)
    {
        *pBi = bi;
    }
    return;
error:
    *pShaderOff = -1;
    *pBi = -1;
}







static SCREEN_LoadFileError SCREEN_loadSceneFromJson(char* code, const char* dir, SCREEN_Scene* desc, vec_char* pathBuf)
{
    vec_char dataBuf[1] = { 0 };
    char path[SCREEN_PATH_BUF_MAX] = "";

    const nx_json* rootJs = nx_json_parse(code, NULL);
    if (!rootJs)
    {
        // todo report error
        return SCREEN_LoadFileError_FileInvalid;
    }
    {
        const nx_json* shaderJs = nx_json_get(rootJs, "commonShader");
        if (shaderJs->type != NX_JSON_NULL)
        {
            if (shaderJs->type != NX_JSON_STRING)
            {
                // todo report error
                goto error;
            }
            const char* filename = shaderJs->text_value;
            snprintf(path, sizeof(path), "%s/%s", dir, filename);
            u32 shaderOff = SCREEN_loadFileDataToBuf(dataBuf, pathBuf, path, true);
            if (-1 == shaderOff)
            {
                // todo report error
                goto error;
            }
            desc->commonShaderCodeOffset = shaderOff;
        }
    }
    const nx_json* buffersJs = nx_json_get(rootJs, "buffers");
    if (buffersJs->type != NX_JSON_NULL)
    {
        if (buffersJs->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        for (int i = 0; i < buffersJs->length; ++i)
        {
            const nx_json* bufferJs = nx_json_item(buffersJs, i);
            u32 shaderOff, bi;
            SCREEN_loadScenePassFromJson(bufferJs, dir, desc, dataBuf, pathBuf, &shaderOff, &bi);
            if (shaderOff != -1)
            {
                assert(bi != -1);
                desc->buffer[bi].shaderCodeOffset = shaderOff;
            }
            else
            {
                // todo report error
                goto error;
            }
        }
    }
    const nx_json* imageJs = nx_json_get(rootJs, "image");
    SCREEN_loadScenePassFromJson(imageJs, dir, desc, dataBuf, pathBuf, &desc->image->shaderCodeOffset, NULL);

    const nx_json* assetsJs = nx_json_get(rootJs, "assets");
    if (assetsJs->type != NX_JSON_NULL)
    {
        if (assetsJs->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        desc->assetCount = assetsJs->length;
        for (int ai = 0; ai < assetsJs->length; ++ai)
        {
            const nx_json* assetJs = nx_json_item(assetsJs, ai);
            u32 dataOff;
            SCREEN_loadSceneAssetFromJson(assetJs, dir, desc->asset + ai, dataBuf, &dataOff, pathBuf);
            if (dataOff != -1)
            {
                desc->asset[ai].dataOffset = dataOff;
            }
            else
            {
                // todo report error
                goto error;
            }
        }
    }

    SCREEN_loadScene(desc, dataBuf->data, dataBuf->length);

    vec_free(dataBuf);
    nx_json_free(rootJs);
    return SCREEN_LoadFileError_NONE;
error:
    vec_free(dataBuf);
    nx_json_free(rootJs);
    return SCREEN_LoadFileError_FileInvalid;
}









SCREEN_LoadFileError SCREEN_loadSceneFile(const char* filename, vec_char* pathBuf)
{
    SCREEN_Scene desc[1] = { SCREEN_sceneEmpty() };

    if (FILEU_fileExist(filename))
    {
        if (FILEU_dirExist(filename))
        {
            char path[SCREEN_PATH_BUF_MAX] = "";
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

                char dir[SCREEN_PATH_BUF_MAX];
                FILEU_getDirName(dir, path);
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
                bool r = SCREEN_loadScene(desc, buf, size + 1);
                free(buf);
                return r ? SCREEN_LoadFileError_NONE : SCREEN_LoadFileError_FileInvalid;
            }
            else if (0 == strcicmp(FILEU_filenameExt(filename), "json"))
            {
                errno = 0;
                u32 size = FILEU_readFile(filename, NULL, 0);
                if ((-1 == size) || !size)
                {
                    printf("Error %d\n", errno);
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

                char dir[SCREEN_PATH_BUF_MAX];
                FILEU_getDirName(dir, filename);
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































































































